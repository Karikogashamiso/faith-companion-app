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
CREATE POLICY "user inserts own flags" ON public.flagged_answers
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "user reads own flags" ON public.flagged_answers
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Admins/moderators review the full queue.
CREATE POLICY "staff read all flags" ON public.flagged_answers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "staff resolve flags" ON public.flagged_answers
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
