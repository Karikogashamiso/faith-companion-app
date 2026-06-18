-- =====================================================================
-- Admin funnel metrics for the in-app analytics dashboard. Aggregates the
-- anonymous landing funnel + signups into one JSON payload. SECURITY DEFINER so
-- it can read landing_events/analytics_events, but self-gated to admins via
-- has_role(auth.uid(),'admin') — a non-admin caller gets an exception.
-- Idempotent.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.admin_funnel_metrics(_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_since timestamptz := now() - make_interval(days => GREATEST(_days, 1));
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;

  SELECT jsonb_build_object(
    'days', GREATEST(_days, 1),
    'views',          count(DISTINCT anon_id) FILTER (WHERE event = 'landing_view'),
    'cta_clickers',   count(DISTINCT anon_id) FILTER (WHERE event = 'cta_click'),
    'demo_users',     count(DISTINCT anon_id) FILTER (WHERE event = 'demo_ask'),
    'store_clickers', count(DISTINCT anon_id) FILTER (WHERE event = 'store_badge_click'),
    'cta_by_location', (
      SELECT COALESCE(jsonb_object_agg(loc, c), '{}'::jsonb)
      FROM (
        SELECT COALESCE(props->>'location', 'unknown') AS loc,
               count(DISTINCT anon_id) AS c
        FROM public.landing_events
        WHERE event = 'cta_click' AND created_at > v_since
        GROUP BY 1
      ) s
    )
  )
  INTO v_result
  FROM public.landing_events
  WHERE created_at > v_since;

  v_result := COALESCE(v_result, '{}'::jsonb) || jsonb_build_object(
    'signups', (
      SELECT count(DISTINCT props->>'anon_id')
      FROM public.analytics_events
      WHERE event = 'landing_conversion' AND created_at > v_since
    ),
    'paywall_views', (
      SELECT count(*)
      FROM public.analytics_events
      WHERE event = 'paywall_viewed' AND created_at > v_since
    )
  );

  RETURN v_result;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.admin_funnel_metrics(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_funnel_metrics(int) TO authenticated, service_role;
