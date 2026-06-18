-- =====================================================================
-- APPLY ALL NEW MIGRATIONS — one paste, runs the whole batch.
--
-- HOW: Supabase dashboard -> SQL Editor -> New query -> paste this whole
--      file -> Run. (Or let Lovable apply supabase/migrations/ on sync.)
--
-- SAFE TO RE-RUN: tables use IF NOT EXISTS, functions use CREATE OR REPLACE,
--      and every policy is dropped-if-exists first. Only the NEW migrations
--      (gamification, audio, prayer wall, reminders, bookmarks, memorize,
--       devotional, translation catalog, hardening, etc.) are included — the
--      base Lovable schema is assumed already applied.
--
-- AFTER APPLYING:
--   1) Regenerate types:  supabase gen types typescript --linked > src/integrations/supabase/types.ts
--   2) Seed the Bible:    node scripts/ingest-web-bible.mjs   (see scripts/README.md)
--   3) Backfill AI embeddings via the in-app admin `embedVerses` job.
-- =====================================================================

-- ===== 20260616220000_security_integrity_hardening.sql =====
-- =====================================================================
-- Hardening pass: usage-limit integrity, group-join lockdown,
-- durable demo rate limiting, reader structure RPCs, data-integrity
-- constraints, and defensive guards on SECURITY DEFINER functions.
--
-- Every statement is additive and idempotent so the migration is safe
-- to re-run. No destructive operations.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) AI usage-counter integrity  [was: users could reset their own count]
--    Lock all writes to the server and expose a single atomic, race-safe
--    "consume" RPC that checks-and-increments under a row lock.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "user writes own ai usage" ON public.ai_usage_daily;
DROP POLICY IF EXISTS "user updates own ai usage" ON public.ai_usage_daily;
REVOKE INSERT, UPDATE ON public.ai_usage_daily FROM authenticated;
-- SELECT is intentionally retained so the UI can show "x of y used today".

CREATE OR REPLACE FUNCTION public.consume_ai_session(_limit int DEFAULT 5)
RETURNS TABLE (allowed boolean, used int, day_limit int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_used int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _limit IS NULL OR _limit < 0 THEN _limit := 5; END IF;

  -- Companions are unlimited; never touch the counter for them.
  IF public.is_companion(v_uid) THEN
    RETURN QUERY SELECT true, 0, _limit;
    RETURN;
  END IF;

  -- Ensure today's row exists, then lock it for an atomic check+increment.
  INSERT INTO public.ai_usage_daily (user_id, usage_date, count)
    VALUES (v_uid, current_date, 0)
    ON CONFLICT (user_id, usage_date) DO NOTHING;

  SELECT count INTO v_used
    FROM public.ai_usage_daily
    WHERE user_id = v_uid AND usage_date = current_date
    FOR UPDATE;

  IF v_used >= _limit THEN
    RETURN QUERY SELECT false, v_used, _limit;
    RETURN;
  END IF;

  UPDATE public.ai_usage_daily
    SET count = count + 1
    WHERE user_id = v_uid AND usage_date = current_date
    RETURNING count INTO v_used;

  RETURN QUERY SELECT true, v_used, _limit;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.consume_ai_session(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_session(int) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2) Group-join lockdown  [was: anyone who knew a group UUID could
--    self-insert into group_members and read private prayer data]
--    Joins must now go exclusively through join_group_by_code() (a
--    SECURITY DEFINER RPC) or the owner-add trigger.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "self joins group" ON public.group_members;
REVOKE INSERT ON public.group_members FROM authenticated;

-- Harden the join RPC against malformed input.
CREATE OR REPLACE FUNCTION public.join_group_by_code(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_group_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _code IS NULL OR btrim(_code) = '' OR length(_code) > 64 THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;
  SELECT id INTO v_group_id
    FROM public.groups
    WHERE upper(join_code) = upper(btrim(_code));
  IF v_group_id IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;
  INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (v_group_id, auth.uid(), 'member')
    ON CONFLICT (group_id, user_id) DO NOTHING;
  RETURN v_group_id;
END;
$fn$;

-- Null-safe membership comparison helper.
CREATE OR REPLACE FUNCTION public.shares_group_with(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT _a IS NOT NULL AND _b IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.group_members m1
    JOIN public.group_members m2 ON m1.group_id = m2.group_id
    WHERE m1.user_id = _a AND m2.user_id = _b
  );
$fn$;

-- ---------------------------------------------------------------------
-- 3) Durable, abuse-resistant rate limiting for the public AI demo
--    [was: in-memory per-process map, bypassable on serverless]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.demo_rate_limits (
  ip text NOT NULL,
  window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (ip, window_start)
);
ALTER TABLE public.demo_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.demo_rate_limits FROM anon, authenticated;
GRANT ALL ON public.demo_rate_limits TO service_role;
-- No RLS policies → only service_role / SECURITY DEFINER may touch it.

CREATE OR REPLACE FUNCTION public.demo_rate_check(
  _ip text,
  _max int DEFAULT 4,
  _window_seconds int DEFAULT 600
)
RETURNS TABLE (allowed boolean, remaining int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_bucket timestamptz;
  v_count int;
BEGIN
  IF _ip IS NULL OR length(_ip) = 0 OR length(_ip) > 100 THEN _ip := 'anon'; END IF;
  IF _max IS NULL OR _max < 1 THEN _max := 4; END IF;
  IF _window_seconds IS NULL OR _window_seconds < 1 THEN _window_seconds := 600; END IF;

  v_bucket := to_timestamp(
    floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds
  );

  INSERT INTO public.demo_rate_limits (ip, window_start, count)
    VALUES (_ip, v_bucket, 0)
    ON CONFLICT (ip, window_start) DO NOTHING;

  SELECT count INTO v_count
    FROM public.demo_rate_limits
    WHERE ip = _ip AND window_start = v_bucket
    FOR UPDATE;

  IF v_count >= _max THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  UPDATE public.demo_rate_limits
    SET count = count + 1
    WHERE ip = _ip AND window_start = v_bucket
    RETURNING count INTO v_count;

  -- Opportunistic cleanup of stale buckets.
  DELETE FROM public.demo_rate_limits WHERE window_start < now() - interval '1 day';

  RETURN QUERY SELECT true, GREATEST(_max - v_count, 0);
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.demo_rate_check(text, int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.demo_rate_check(text, int, int) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4) Bible reader structure RPC
--    [was: the reader fetched EVERY verse of a version just to derive
--     the list of books, and hardcoded chapters 1..50]
--    Returns each book with its chapter count, in canonical (insertion)
--    order. Cheap, indexed aggregate.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bible_books(p_version_id uuid)
RETURNS TABLE (book text, chapters int)
LANGUAGE sql STABLE SET search_path = public AS $fn$
  SELECT v.book, MAX(v.chapter)::int AS chapters
  FROM public.verses v
  WHERE v.version_id = p_version_id
  GROUP BY v.book
  ORDER BY MIN(v.id);
$fn$;
REVOKE EXECUTE ON FUNCTION public.bible_books(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.bible_books(uuid) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5) Hardened retrieval: clamp match_count to a sane range to remove the
--    DoS vector (e.g. match_count = 1_000_000). Same hybrid FTS+vector
--    logic as before.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_verses(
  query_embedding vector(1536),
  query_text text,
  p_version_id uuid,
  match_count int DEFAULT 12
) RETURNS TABLE (
  id bigint,
  book text,
  chapter int,
  verse int,
  text text,
  score double precision
)
LANGUAGE sql STABLE
SET search_path = public
AS $fn$
  WITH bounds AS (
    SELECT LEAST(GREATEST(COALESCE(match_count, 12), 1), 50) AS n
  ),
  fts AS (
    SELECT v.id, v.book, v.chapter, v.verse, v.text,
      ts_rank(to_tsvector('english', v.text),
              websearch_to_tsquery('english', COALESCE(query_text,''))) AS s
    FROM public.verses v, bounds
    WHERE v.version_id = p_version_id
      AND query_text IS NOT NULL
      AND to_tsvector('english', v.text) @@ websearch_to_tsquery('english', query_text)
    ORDER BY s DESC
    LIMIT (SELECT n FROM bounds) * 4
  ),
  vec AS (
    SELECT v.id, v.book, v.chapter, v.verse, v.text,
      (1 - (v.embedding <=> query_embedding))::double precision AS s
    FROM public.verses v, bounds
    WHERE v.version_id = p_version_id
      AND query_embedding IS NOT NULL
      AND v.embedding IS NOT NULL
    ORDER BY v.embedding <=> query_embedding
    LIMIT (SELECT n FROM bounds) * 4
  ),
  merged AS (
    SELECT id, book, chapter, verse, text, s FROM fts
    UNION ALL
    SELECT id, book, chapter, verse, text, s FROM vec
  )
  SELECT id, book, chapter, verse, text, MAX(s) AS score
  FROM merged
  GROUP BY id, book, chapter, verse, text
  ORDER BY score DESC
  LIMIT (SELECT n FROM bounds);
$fn$;
REVOKE EXECUTE ON FUNCTION public.match_verses(vector, text, uuid, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.match_verses(vector, text, uuid, int) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6) Data-integrity constraints  [was: free-text columns that should be
--    constrained]. Added NOT VALID so legacy rows are never rejected,
--    but all new writes are enforced.
-- ---------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_study_logs_crisis_level_chk') THEN
    ALTER TABLE public.ai_study_logs
      ADD CONSTRAINT ai_study_logs_crisis_level_chk
      CHECK (crisis_level IN ('none','pastoral','crisis')) NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_activity_source_chk') THEN
    ALTER TABLE public.daily_activity
      ADD CONSTRAINT daily_activity_source_chk
      CHECK (source IN ('home','reader','plan','widget','prayer','search')) NOT VALID;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 7) Performance: full-text index for in-group prayer search (future),
--    and GIN over onboarding struggle arrays for cohort queries.
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS prayer_requests_body_search_idx
  ON public.prayer_requests USING gin (to_tsvector('english', body));

CREATE INDEX IF NOT EXISTS onboarding_struggles_idx
  ON public.onboarding_answers USING gin (struggles);


-- ===== 20260616221000_reading_plan_loop.sql =====
-- =====================================================================
-- Reading-plan loop: an individual "active plan" pointer + seeded starter
-- plans so the daily core loop works end to end. Idempotent.
-- =====================================================================

-- Individual active plan (groups already have active_plan_id; users didn't).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_plan_id uuid
  REFERENCES public.reading_plans(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- Free starter plan — "Finding Peace in Anxious Times" (7 days), built
-- entirely from verses already seeded so passages always resolve.
-- ---------------------------------------------------------------------
INSERT INTO public.reading_plans (id, title, description, tradition, day_count, is_premium)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'Finding Peace in Anxious Times',
  'A gentle 7-day walk through Scripture''s words on worry, provision, and the peace of God.',
  NULL, 7, false
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.plan_days (plan_id, day_number, passage_ref, reflection_md, prayer_md)
VALUES
  ('11111111-1111-4111-8111-111111111111', 1, 'Philippians 4:6-7',
   'Anxiety asks us to carry tomorrow today. Paul offers another way: bring it to God in prayer, with thanksgiving, and receive a peace that outruns understanding.',
   'Lord, I bring you what I am carrying. Trade my worry for your peace today.'),
  ('11111111-1111-4111-8111-111111111111', 2, 'Matthew 6:25-27',
   'Jesus points to the birds — fed without striving. You are worth more. Worry adds nothing; trust adds rest.',
   'Father, remind me of my worth to you, and quiet my striving.'),
  ('11111111-1111-4111-8111-111111111111', 3, '1 Peter 5:7',
   'Casting is an action — a deliberate throwing of your cares onto One strong enough to hold them. He cares for you.',
   'I cast my cares on you, because you care for me.'),
  ('11111111-1111-4111-8111-111111111111', 4, 'Psalms 34:17-18',
   'God is not distant from the broken-hearted. He is near, and he hears. Your cry is not unheard.',
   'Draw near to me today, Lord. Let me know you are close.'),
  ('11111111-1111-4111-8111-111111111111', 5, 'Isaiah 41:10',
   'Three promises against fear: I am with you, I will strengthen you, I will uphold you. Lean on them.',
   'When fear rises, steady me with your right hand.'),
  ('11111111-1111-4111-8111-111111111111', 6, 'Romans 8:28',
   'Not that all things ARE good — but that God works in all things for good for those who love him. Nothing is wasted.',
   'Work even this for good, Lord. I trust your purpose.'),
  ('11111111-1111-4111-8111-111111111111', 7, 'Romans 15:13',
   'A closing blessing: may the God of hope fill you with joy and peace as you trust him, so hope overflows.',
   'God of hope, fill me, that I might overflow to others.')
ON CONFLICT (plan_id, day_number) DO NOTHING;

-- ---------------------------------------------------------------------
-- Premium plan — "The Heart of the Gospel" (5 days). Demonstrates the
-- gated/Companion path in the picker.
-- ---------------------------------------------------------------------
INSERT INTO public.reading_plans (id, title, description, tradition, day_count, is_premium)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  'The Heart of the Gospel',
  'Five days through grace, faith, and love — the foundation of the Christian hope.',
  NULL, 5, true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.plan_days (plan_id, day_number, passage_ref, reflection_md, prayer_md)
VALUES
  ('22222222-2222-4222-8222-222222222222', 1, 'John 3:16',
   'The gospel in one sentence: love that gives, so that whoever believes might live.',
   'Thank you for loving the world — and me — enough to give.'),
  ('22222222-2222-4222-8222-222222222222', 2, 'Romans 5:8',
   'Not after we cleaned ourselves up — while we were still sinners, Christ died. Grace meets us as we are.',
   'I receive your love that came before I deserved it.'),
  ('22222222-2222-4222-8222-222222222222', 3, 'Ephesians 2:8-9',
   'Saved by grace through faith — a gift, not a wage. There is nothing to boast in but the Giver.',
   'I stop earning. I simply receive your gift today.'),
  ('22222222-2222-4222-8222-222222222222', 4, '1 Corinthians 13:4-7',
   'The love that saved us is the love we are called to live: patient, kind, enduring all things.',
   'Make your love in me patient and kind toward others.'),
  ('22222222-2222-4222-8222-222222222222', 5, 'James 2:17',
   'Faith that is alive moves. Grace received becomes grace expressed in how we live.',
   'Let my faith show up in my hands and feet this week.')
ON CONFLICT (plan_id, day_number) DO NOTHING;


-- ===== 20260616222000_flagged_answers.sql =====
-- =====================================================================
-- Human-in-the-loop trust loop: let users flag an AI answer they think is
-- wrong/misleading, and give admins a review queue. Directly de-risks the
-- "one confidently-wrong doctrine answer" failure mode. Idempotent.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.flagged_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  reason text,
  refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flagged_answers_unresolved_idx
  ON public.flagged_answers (resolved, created_at DESC);

GRANT SELECT, INSERT ON public.flagged_answers TO authenticated;
GRANT ALL ON public.flagged_answers TO service_role;
ALTER TABLE public.flagged_answers ENABLE ROW LEVEL SECURITY;

-- Users may file and read their own flags.
DROP POLICY IF EXISTS "user inserts own flags" ON public.flagged_answers;
CREATE POLICY "user inserts own flags" ON public.flagged_answers
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "user reads own flags" ON public.flagged_answers;
CREATE POLICY "user reads own flags" ON public.flagged_answers
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Admins/moderators review the full queue.
DROP POLICY IF EXISTS "staff read all flags" ON public.flagged_answers;
CREATE POLICY "staff read all flags" ON public.flagged_answers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
DROP POLICY IF EXISTS "staff resolve flags" ON public.flagged_answers;
CREATE POLICY "staff resolve flags" ON public.flagged_answers
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));


-- ===== 20260616223000_gamification.sql =====
-- =====================================================================
-- Gamification & habit engine: XP, levels, achievements, streak freezes.
-- Retention is the subscription flywheel — this is the core of it.
-- Server-authoritative (XP/unlocks granted only via SECURITY DEFINER RPCs).
-- Idempotent.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp int NOT NULL DEFAULT 0,
  streak_freezes int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_stats TO authenticated;
GRANT ALL ON public.user_stats TO service_role;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user reads own stats" ON public.user_stats;
CREATE POLICY "user reads own stats" ON public.user_stats
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Achievement catalog (public read).
CREATE TABLE IF NOT EXISTS public.achievements (
  code text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  xp int NOT NULL DEFAULT 0,
  sort int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.achievements TO anon, authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone reads achievements" ON public.achievements;
CREATE POLICY "anyone reads achievements" ON public.achievements
  FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL REFERENCES public.achievements(code) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, code)
);
GRANT SELECT ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user reads own achievements" ON public.user_achievements;
CREATE POLICY "user reads own achievements" ON public.user_achievements
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Seed the catalog. Streak/plan/daily ones are wired now; the rest are
-- visible as goals (locked) which itself drives engagement.
INSERT INTO public.achievements (code, title, description, icon, xp, sort) VALUES
  ('first_step',   'First Step',     'Complete your first day',        'flag',                    20, 1),
  ('streak_3',     'Kindled',        'Reach a 3-day streak',           'local_fire_department',   30, 2),
  ('streak_7',     'Faithful Week',  'Reach a 7-day streak',           'local_fire_department',   50, 3),
  ('streak_30',    'Devoted',        'Reach a 30-day streak',          'military_tech',          150, 4),
  ('plan_started', 'On the Path',    'Start a reading plan',           'map',                     20, 5),
  ('plan_done',    'Finisher',       'Complete a reading plan',        'verified',               100, 6),
  ('seeker',       'Seeker',         'Ask the Companion a question',   'auto_awesome',            30, 7),
  ('intercessor',  'Intercessor',    'Pray for someone in your group', 'front_hand',              30, 8)
ON CONFLICT (code) DO NOTHING;

-- Award XP to the caller (clamped). Creates the stats row on first use.
CREATE OR REPLACE FUNCTION public.add_xp(_amount int)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_xp int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount IS NULL OR _amount < 0 THEN _amount := 0; END IF;
  IF _amount > 100 THEN _amount := 100; END IF;  -- anti-farm clamp
  INSERT INTO public.user_stats (user_id, xp)
    VALUES (v_uid, _amount)
    ON CONFLICT (user_id)
    DO UPDATE SET xp = public.user_stats.xp + _amount, updated_at = now()
    RETURNING xp INTO v_xp;
  RETURN v_xp;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.add_xp(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.add_xp(int) TO authenticated;

-- Unlock an achievement for the caller. Idempotent; awards its XP exactly
-- once. Returns true only on first unlock (so the UI can celebrate).
CREATE OR REPLACE FUNCTION public.unlock_achievement(_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_xp int;
  v_new boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT xp INTO v_xp FROM public.achievements WHERE code = _code;
  IF v_xp IS NULL THEN RETURN false; END IF;  -- unknown code

  INSERT INTO public.user_achievements (user_id, code)
    VALUES (v_uid, _code)
    ON CONFLICT (user_id, code) DO NOTHING;
  GET DIAGNOSTICS v_new = ROW_COUNT;

  IF v_new THEN
    INSERT INTO public.user_stats (user_id, xp)
      VALUES (v_uid, v_xp)
      ON CONFLICT (user_id)
      DO UPDATE SET xp = public.user_stats.xp + v_xp, updated_at = now();
  END IF;
  RETURN v_new;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.unlock_achievement(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.unlock_achievement(text) TO authenticated;


-- ===== 20260616224000_audio_library.sql =====
-- =====================================================================
-- Premium audio library — the core paywalled asset (Hallow's model):
-- guided prayers, audio Scripture, sleep & rest, worship. A few free
-- samples act as the hook; the rest sit behind Companion.
--
-- audio_url is a CDN pointer the operator fills in with real/licensed
-- assets; the UI handles a null/unavailable URL gracefully.
-- Idempotent.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.audio_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  category text NOT NULL,            -- prayer | scripture | sleep | worship
  narrator text,
  duration_seconds int NOT NULL DEFAULT 0,
  audio_url text,                    -- CDN url; null = "coming soon"
  is_premium boolean NOT NULL DEFAULT true,
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audio_tracks_category_idx
  ON public.audio_tracks (category, sort);

GRANT SELECT ON public.audio_tracks TO anon, authenticated;
GRANT ALL ON public.audio_tracks TO service_role;
ALTER TABLE public.audio_tracks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone reads audio catalog" ON public.audio_tracks;
CREATE POLICY "anyone reads audio catalog" ON public.audio_tracks
  FOR SELECT TO anon, authenticated USING (true);

-- Per-user resume position + completion (also feeds habit tracking).
CREATE TABLE IF NOT EXISTS public.audio_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.audio_tracks(id) ON DELETE CASCADE,
  position_seconds int NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);
GRANT SELECT, INSERT, UPDATE ON public.audio_progress TO authenticated;
GRANT ALL ON public.audio_progress TO service_role;
ALTER TABLE public.audio_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own audio progress" ON public.audio_progress;
CREATE POLICY "own audio progress" ON public.audio_progress
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Seed catalog. Two free samples (the hook); the rest are Companion.
INSERT INTO public.audio_tracks
  (title, subtitle, category, narrator, duration_seconds, audio_url, is_premium, sort)
VALUES
  ('Morning Examen',        'Begin the day in stillness',        'prayer',    'Companion', 480,  NULL, false, 1),
  ('Psalm 23 — Read Aloud', 'The Lord is my shepherd',           'scripture', 'Companion', 180,  NULL, false, 2),
  ('Evening Compline',      'A prayer to close the day',         'prayer',    'Companion', 600,  NULL, true,  3),
  ('Be Still — 10 min',     'Guided breath & Scripture',         'prayer',    'Companion', 600,  NULL, true,  4),
  ('Sermon on the Mount',   'Matthew 5–7, narrated',             'scripture', 'Companion', 1500, NULL, true,  5),
  ('Sleep in His Peace',    'Scripture & soft sound for rest',   'sleep',     'Companion', 2400, NULL, true,  6),
  ('Rest — Psalms at Night','Psalms to quiet an anxious mind',   'sleep',     'Companion', 1800, NULL, true,  7),
  ('Be Thou My Vision',     'Instrumental hymn',                 'worship',   'Companion', 300,  NULL, true,  8),
  ('Great Is Thy Faithfulness','Instrumental hymn',              'worship',   'Companion', 320,  NULL, true,  9)
ON CONFLICT DO NOTHING;


-- ===== 20260616225000_daily_devotional.sql =====
-- =====================================================================
-- Wave 3: a personalized daily AI devotional, cached once per user per day
-- so the LLM cost is bounded and the "daily word" feels instant on repeat
-- views. Grounded on the user's real verse of the day (no fabricated text).
-- Idempotent.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.daily_devotionals (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  devo_date date NOT NULL,
  verse_ref text NOT NULL,
  reflection text NOT NULL,
  prayer text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, devo_date)
);
GRANT SELECT, INSERT ON public.daily_devotionals TO authenticated;
GRANT ALL ON public.daily_devotionals TO service_role;
ALTER TABLE public.daily_devotionals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own devotionals read" ON public.daily_devotionals;
CREATE POLICY "own devotionals read" ON public.daily_devotionals
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "own devotionals insert" ON public.daily_devotionals;
CREATE POLICY "own devotionals insert" ON public.daily_devotionals
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());


-- ===== 20260616226000_global_prayer_wall.sql =====
-- =====================================================================
-- Phase 4: a global "pray together" wall — public prayer requests anyone can
-- pray for in real time (the community stickiness lever). author_name is
-- snapshotted at post time so we never need to expose other users' profiles.
-- The prayed counter is incremented only through an atomic SECURITY DEFINER
-- RPC, so it can't be inflated from the client. Idempotent.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.global_prayers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT 'Anonymous',
  body text NOT NULL,
  prayed_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS global_prayers_feed_idx
  ON public.global_prayers (status, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.global_prayers TO authenticated;
GRANT ALL ON public.global_prayers TO service_role;
ALTER TABLE public.global_prayers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read open prayers" ON public.global_prayers;
CREATE POLICY "read open prayers" ON public.global_prayers
  FOR SELECT TO authenticated
  USING (status = 'open' OR author_id = auth.uid());
DROP POLICY IF EXISTS "post own prayer" ON public.global_prayers;
CREATE POLICY "post own prayer" ON public.global_prayers
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
DROP POLICY IF EXISTS "delete own prayer" ON public.global_prayers;
CREATE POLICY "delete own prayer" ON public.global_prayers
  FOR DELETE TO authenticated USING (author_id = auth.uid());
-- No client UPDATE: prayed_count moves only via the RPC below.

CREATE TABLE IF NOT EXISTS public.global_prayer_prayed (
  prayer_id uuid NOT NULL REFERENCES public.global_prayers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (prayer_id, user_id)
);
GRANT SELECT ON public.global_prayer_prayed TO authenticated;
GRANT ALL ON public.global_prayer_prayed TO service_role;
ALTER TABLE public.global_prayer_prayed ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read own prayed" ON public.global_prayer_prayed;
CREATE POLICY "read own prayed" ON public.global_prayer_prayed
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Atomic, idempotent "I prayed for this": records the prayer once and bumps
-- the counter under a row lock. Returns the new total.
CREATE OR REPLACE FUNCTION public.pray_for_global(_prayer_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_new boolean;
  v_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  INSERT INTO public.global_prayer_prayed (prayer_id, user_id)
    VALUES (_prayer_id, v_uid)
    ON CONFLICT (prayer_id, user_id) DO NOTHING;
  GET DIAGNOSTICS v_new = ROW_COUNT;

  IF v_new THEN
    UPDATE public.global_prayers
      SET prayed_count = prayed_count + 1
      WHERE id = _prayer_id
      RETURNING prayed_count INTO v_count;
  ELSE
    SELECT prayed_count INTO v_count FROM public.global_prayers WHERE id = _prayer_id;
  END IF;

  RETURN COALESCE(v_count, 0);
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.pray_for_global(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.pray_for_global(uuid) TO authenticated;


-- ===== 20260616227000_engagement_features.sql =====
-- =====================================================================
-- Engagement features: personal prayer list, bookmarks/collections, and
-- verse memorization (spaced repetition). All user-scoped, RLS own-rows.
-- Idempotent.
-- =====================================================================

-- ---- Personal prayer list (private; complements the public wall) --------
CREATE TABLE IF NOT EXISTS public.personal_prayers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  answered boolean NOT NULL DEFAULT false,
  answered_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz
);
CREATE INDEX IF NOT EXISTS personal_prayers_user_idx
  ON public.personal_prayers (user_id, answered, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_prayers TO authenticated;
GRANT ALL ON public.personal_prayers TO service_role;
ALTER TABLE public.personal_prayers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own personal prayers" ON public.personal_prayers;
CREATE POLICY "own personal prayers" ON public.personal_prayers
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---- Bookmarks & collections (extends highlights) -----------------------
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verse_id bigint NOT NULL REFERENCES public.verses(id) ON DELETE CASCADE,
  collection text NOT NULL DEFAULT 'Saved',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, verse_id, collection)
);
CREATE INDEX IF NOT EXISTS bookmarks_user_idx
  ON public.bookmarks (user_id, collection, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookmarks TO authenticated;
GRANT ALL ON public.bookmarks TO service_role;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own bookmarks" ON public.bookmarks;
CREATE POLICY "own bookmarks" ON public.bookmarks
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---- Verse memorization (spaced repetition; the retention moat) ---------
-- Snapshots ref + text so a memorized verse is stable even if the user
-- later switches translation.
CREATE TABLE IF NOT EXISTS public.memory_verses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verse_ref text NOT NULL,
  verse_text text NOT NULL,
  stage int NOT NULL DEFAULT 0,
  due_at date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE (user_id, verse_ref)
);
CREATE INDEX IF NOT EXISTS memory_verses_due_idx
  ON public.memory_verses (user_id, due_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory_verses TO authenticated;
GRANT ALL ON public.memory_verses TO service_role;
ALTER TABLE public.memory_verses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own memory verses" ON public.memory_verses;
CREATE POLICY "own memory verses" ON public.memory_verses
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- ===== 20260616228000_reminders.sql =====
-- =====================================================================
-- Reminders / alarms: multiple per-user verse & prayer reminder times with
-- day-of-week scheduling. Stored server-side so they're ready for push
-- delivery; the client also fires in-app notifications while open. RLS own.
-- Idempotent.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'prayer' CHECK (kind IN ('verse', 'prayer')),
  label text NOT NULL DEFAULT '',
  at_time time NOT NULL,
  days int[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',  -- 0=Sun … 6=Sat
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reminders_user_idx
  ON public.reminders (user_id, enabled);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own reminders" ON public.reminders;
CREATE POLICY "own reminders" ON public.reminders
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- ===== 20260616229000_chapter_summaries.sql =====
-- =====================================================================
-- "Explain this chapter" — cache of AI chapter summaries, shared across all
-- users (they're general, not personal), so each chapter is generated once.
-- Public read; writes happen server-side via the service role. Idempotent.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.chapter_summaries (
  version_id uuid NOT NULL REFERENCES public.bible_versions(id) ON DELETE CASCADE,
  book text NOT NULL,
  chapter int NOT NULL,
  summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (version_id, book, chapter)
);
GRANT SELECT ON public.chapter_summaries TO anon, authenticated;
GRANT ALL ON public.chapter_summaries TO service_role;
ALTER TABLE public.chapter_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone reads chapter summaries" ON public.chapter_summaries;
CREATE POLICY "anyone reads chapter summaries" ON public.chapter_summaries
  FOR SELECT TO anon, authenticated USING (true);


-- ===== 20260616230000_translation_catalog.sql =====
-- =====================================================================
-- Bible translation catalog: the common public-domain translations across
-- traditions (Protestant + Catholic). Copyrighted versions (NIV/ESV/NLT/…)
-- are intentionally NOT seeded — they require a publisher license; add them
-- the same way once licensed. Idempotent.
-- =====================================================================

-- Make abbreviation unique so the catalog upserts cleanly.
CREATE UNIQUE INDEX IF NOT EXISTS bible_versions_abbr_uniq
  ON public.bible_versions (abbreviation);

INSERT INTO public.bible_versions (name, abbreviation, language, license_notes, is_public_domain)
VALUES
  ('World English Bible',        'WEB', 'en', 'Public domain',                 true),
  ('King James Version',         'KJV', 'en', 'Public domain (1769)',          true),
  ('American Standard Version',  'ASV', 'en', 'Public domain (1901)',          true),
  ('Young''s Literal Translation','YLT','en', 'Public domain',                 true),
  ('Bible in Basic English',     'BBE', 'en', 'Public domain',                 true),
  ('Douay-Rheims (Catholic)',    'DRA', 'en', 'Public domain (Catholic canon)',true)
ON CONFLICT (abbreviation) DO NOTHING;

-- Only translations that actually have verse text should appear in pickers,
-- so seeded-but-not-yet-ingested versions stay hidden until populated.
CREATE OR REPLACE FUNCTION public.versions_with_content()
RETURNS TABLE (id uuid, name text, abbreviation text, language text)
LANGUAGE sql STABLE SET search_path = public AS $fn$
  SELECT v.id, v.name, v.abbreviation, v.language
  FROM public.bible_versions v
  WHERE EXISTS (SELECT 1 FROM public.verses x WHERE x.version_id = v.id)
  ORDER BY v.abbreviation;
$fn$;
REVOKE EXECUTE ON FUNCTION public.versions_with_content() FROM public;
GRANT EXECUTE ON FUNCTION public.versions_with_content() TO anon, authenticated, service_role;




-- ===== 20260617030000_popular_translations.sql =====
-- Expand the catalog with the 8 most popular Bible translations (flagship: WEB).
-- Public-domain rows ship now; licensed rows require a publisher agreement and
-- stay hidden in pickers until verses exist. Idempotent.
INSERT INTO public.bible_versions (name, abbreviation, language, license_notes, is_public_domain)
VALUES
  ('World English Bible, British & Catholic Edition', 'WEBBE', 'en',
     'Public domain (includes Deuterocanon)', true),
  ('Darby Translation',          'DBY', 'en', 'Public domain (1890)', true),
  ('New International Version',   'NIV',  'en', 'Licensed — Biblica / Zondervan',        false),
  ('English Standard Version',    'ESV',  'en', 'Licensed — Crossway',                   false),
  ('New Living Translation',      'NLT',  'en', 'Licensed — Tyndale House',              false),
  ('New King James Version',      'NKJV', 'en', 'Licensed — Thomas Nelson (HarperCollins)', false),
  ('New American Standard Bible', 'NASB', 'en', 'Licensed — The Lockman Foundation',     false),
  ('Christian Standard Bible',    'CSB',  'en', 'Licensed — Holman / Lifeway',           false)
ON CONFLICT (abbreviation) DO NOTHING;


-- ===== 20260617040000_stripe_billing.sql =====
-- Stripe web billing: reconciliation column so the Stripe webhook can map
-- subscription events back to a Supabase user. Idempotent.
ALTER TABLE public.entitlements
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;
CREATE UNIQUE INDEX IF NOT EXISTS entitlements_stripe_customer_uniq
  ON public.entitlements (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
