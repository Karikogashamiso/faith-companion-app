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
CREATE POLICY "own devotionals read" ON public.daily_devotionals
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own devotionals insert" ON public.daily_devotionals
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
