-- =====================================================================
-- Landing-page (anonymous) conversion analytics. analytics_events requires a
-- user_id, so it can't capture top-of-funnel visitors. This table records
-- anonymous landing events (keyed by a localStorage anon_id) so we can measure
-- view → CTA-click → signup conversion. Written only by the public
-- /api/public/track endpoint (service role); no client policies. Idempotent.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.landing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_id text NOT NULL,
  event text NOT NULL,
  path text,
  referrer text,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS landing_events_event_idx ON public.landing_events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS landing_events_anon_idx ON public.landing_events (anon_id, created_at DESC);

GRANT ALL ON public.landing_events TO service_role;
ALTER TABLE public.landing_events ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: only the service-role endpoint writes; analysts
-- query with the service role / SQL editor.
