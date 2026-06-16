
CREATE TABLE IF NOT EXISTS public.daily_activity (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_date date NOT NULL,
  source text NOT NULL DEFAULT 'home',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, activity_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_activity TO authenticated;
GRANT ALL ON public.daily_activity TO service_role;
ALTER TABLE public.daily_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own daily activity" ON public.daily_activity FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.user_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verse_id bigint NOT NULL REFERENCES public.verses(id) ON DELETE CASCADE,
  color text NOT NULL DEFAULT 'yellow',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, verse_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_highlights TO authenticated;
GRANT ALL ON public.user_highlights TO service_role;
ALTER TABLE public.user_highlights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own highlights" ON public.user_highlights FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Deterministic verse-of-the-day; same date+version => same verse for everyone.
CREATE OR REPLACE FUNCTION public.verse_of_the_day(p_version_id uuid, p_date date DEFAULT (now() AT TIME ZONE 'utc')::date)
RETURNS TABLE(id bigint, book text, chapter int, verse int, text text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pool AS (
    SELECT v.id, v.book, v.chapter, v.verse, v.text,
           row_number() OVER (ORDER BY v.id) - 1 AS rn,
           count(*) OVER () AS n
    FROM public.verses v
    WHERE v.version_id = p_version_id
  )
  SELECT id, book, chapter, verse, text FROM pool
  WHERE n > 0
    AND rn = (abs(hashtext(p_date::text)) % GREATEST(n, 1))
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.verse_of_the_day(uuid, date) TO anon, authenticated;
