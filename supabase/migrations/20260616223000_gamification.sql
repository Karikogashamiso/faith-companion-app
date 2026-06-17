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
