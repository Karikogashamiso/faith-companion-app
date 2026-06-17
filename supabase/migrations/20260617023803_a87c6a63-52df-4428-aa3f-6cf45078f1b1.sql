-- (full migration body)
DROP POLICY IF EXISTS "user writes own ai usage" ON public.ai_usage_daily;
DROP POLICY IF EXISTS "user updates own ai usage" ON public.ai_usage_daily;
REVOKE INSERT, UPDATE ON public.ai_usage_daily FROM authenticated;

CREATE OR REPLACE FUNCTION public.consume_ai_session(_limit int DEFAULT 5)
RETURNS TABLE (allowed boolean, used int, day_limit int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_used int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _limit IS NULL OR _limit < 0 THEN _limit := 5; END IF;
  IF public.is_companion(v_uid) THEN
    RETURN QUERY SELECT true, 0, _limit;
    RETURN;
  END IF;
  INSERT INTO public.ai_usage_daily (user_id, usage_date, count)
    VALUES (v_uid, current_date, 0)
    ON CONFLICT (user_id, usage_date) DO NOTHING;
  SELECT count INTO v_used FROM public.ai_usage_daily
    WHERE user_id = v_uid AND usage_date = current_date FOR UPDATE;
  IF v_used >= _limit THEN
    RETURN QUERY SELECT false, v_used, _limit;
    RETURN;
  END IF;
  UPDATE public.ai_usage_daily SET count = count + 1
    WHERE user_id = v_uid AND usage_date = current_date
    RETURNING count INTO v_used;
  RETURN QUERY SELECT true, v_used, _limit;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.consume_ai_session(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_session(int) TO authenticated, service_role;

DROP POLICY IF EXISTS "self joins group" ON public.group_members;
REVOKE INSERT ON public.group_members FROM authenticated;

CREATE OR REPLACE FUNCTION public.join_group_by_code(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_group_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _code IS NULL OR btrim(_code) = '' OR length(_code) > 64 THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;
  SELECT id INTO v_group_id FROM public.groups
    WHERE upper(join_code) = upper(btrim(_code));
  IF v_group_id IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;
  INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (v_group_id, auth.uid(), 'member')
    ON CONFLICT (group_id, user_id) DO NOTHING;
  RETURN v_group_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.shares_group_with(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT _a IS NOT NULL AND _b IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.group_members m1
    JOIN public.group_members m2 ON m1.group_id = m2.group_id
    WHERE m1.user_id = _a AND m2.user_id = _b
  );
$fn$;

CREATE TABLE IF NOT EXISTS public.demo_rate_limits (
  ip text NOT NULL,
  window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (ip, window_start)
);
ALTER TABLE public.demo_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.demo_rate_limits FROM anon, authenticated;
GRANT ALL ON public.demo_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.demo_rate_check(_ip text, _max int DEFAULT 4, _window_seconds int DEFAULT 600)
RETURNS TABLE (allowed boolean, remaining int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_bucket timestamptz; v_count int;
BEGIN
  IF _ip IS NULL OR length(_ip) = 0 OR length(_ip) > 100 THEN _ip := 'anon'; END IF;
  IF _max IS NULL OR _max < 1 THEN _max := 4; END IF;
  IF _window_seconds IS NULL OR _window_seconds < 1 THEN _window_seconds := 600; END IF;
  v_bucket := to_timestamp(floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds);
  INSERT INTO public.demo_rate_limits (ip, window_start, count)
    VALUES (_ip, v_bucket, 0)
    ON CONFLICT (ip, window_start) DO NOTHING;
  SELECT count INTO v_count FROM public.demo_rate_limits
    WHERE ip = _ip AND window_start = v_bucket FOR UPDATE;
  IF v_count >= _max THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;
  UPDATE public.demo_rate_limits SET count = count + 1
    WHERE ip = _ip AND window_start = v_bucket RETURNING count INTO v_count;
  DELETE FROM public.demo_rate_limits WHERE window_start < now() - interval '1 day';
  RETURN QUERY SELECT true, GREATEST(_max - v_count, 0);
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.demo_rate_check(text, int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.demo_rate_check(text, int, int) TO anon, authenticated, service_role;

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

CREATE OR REPLACE FUNCTION public.match_verses(
  query_embedding vector(1536), query_text text, p_version_id uuid, match_count int DEFAULT 12
) RETURNS TABLE (id bigint, book text, chapter int, verse int, text text, score double precision)
LANGUAGE sql STABLE SET search_path = public AS $fn$
  WITH bounds AS (SELECT LEAST(GREATEST(COALESCE(match_count, 12), 1), 50) AS n),
  fts AS (
    SELECT v.id, v.book, v.chapter, v.verse, v.text,
      ts_rank(to_tsvector('english', v.text),
              websearch_to_tsquery('english', COALESCE(query_text,''))) AS s
    FROM public.verses v, bounds
    WHERE v.version_id = p_version_id
      AND query_text IS NOT NULL
      AND to_tsvector('english', v.text) @@ websearch_to_tsquery('english', query_text)
    ORDER BY s DESC LIMIT (SELECT n FROM bounds) * 4
  ),
  vec AS (
    SELECT v.id, v.book, v.chapter, v.verse, v.text,
      (1 - (v.embedding <=> query_embedding))::double precision AS s
    FROM public.verses v, bounds
    WHERE v.version_id = p_version_id
      AND query_embedding IS NOT NULL AND v.embedding IS NOT NULL
    ORDER BY v.embedding <=> query_embedding LIMIT (SELECT n FROM bounds) * 4
  ),
  merged AS (
    SELECT id, book, chapter, verse, text, s FROM fts
    UNION ALL SELECT id, book, chapter, verse, text, s FROM vec
  )
  SELECT id, book, chapter, verse, text, MAX(s) AS score
  FROM merged GROUP BY id, book, chapter, verse, text
  ORDER BY score DESC LIMIT (SELECT n FROM bounds);
$fn$;
REVOKE EXECUTE ON FUNCTION public.match_verses(vector, text, uuid, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.match_verses(vector, text, uuid, int) TO authenticated, service_role;

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

CREATE INDEX IF NOT EXISTS prayer_requests_body_search_idx
  ON public.prayer_requests USING gin (to_tsvector('english', body));

CREATE INDEX IF NOT EXISTS onboarding_struggles_idx
  ON public.onboarding_answers USING gin (struggles);