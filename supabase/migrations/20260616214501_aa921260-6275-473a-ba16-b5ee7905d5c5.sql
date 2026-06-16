
ALTER TABLE public.onboarding_answers
  ADD COLUMN IF NOT EXISTS variant_screen1 TEXT,
  ADD COLUMN IF NOT EXISTS variant_screen10 TEXT;

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  variant_screen1 TEXT,
  variant_screen10 TEXT,
  props JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.analytics_events TO authenticated;
GRANT ALL ON public.analytics_events TO service_role;

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own analytics events"
  ON public.analytics_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read their own analytics events"
  ON public.analytics_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS analytics_events_event_idx ON public.analytics_events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_user_idx ON public.analytics_events (user_id, created_at DESC);
