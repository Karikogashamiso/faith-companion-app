
CREATE TABLE IF NOT EXISTS public.entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'free' CHECK (tier IN ('free','companion','companion_gift')),
  source text,                          -- 'revenuecat', 'gift', 'promo', 'manual'
  product_id text,                      -- e.g. 'companion_monthly', 'companion_annual'
  store text,                           -- 'app_store', 'play_store', 'stripe', 'promo'
  trial_ends_at timestamptz,
  expires_at timestamptz,               -- null = perpetual / not expiring
  rc_app_user_id text,                  -- RevenueCat appUserId for reconciliation
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.entitlements TO authenticated;
GRANT ALL ON public.entitlements TO service_role;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own entitlement"
  ON public.entitlements FOR SELECT USING (user_id = auth.uid());
-- Note: no INSERT/UPDATE/DELETE policies for authenticated → only service_role can write.

CREATE TABLE IF NOT EXISTS public.ai_usage_daily (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);
GRANT SELECT, INSERT, UPDATE ON public.ai_usage_daily TO authenticated;
GRANT ALL ON public.ai_usage_daily TO service_role;
ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own ai usage" ON public.ai_usage_daily FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "user writes own ai usage" ON public.ai_usage_daily FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "user updates own ai usage" ON public.ai_usage_daily FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_companion(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.entitlements e
    WHERE e.user_id = _user_id
      AND e.tier IN ('companion','companion_gift')
      AND (e.expires_at IS NULL OR e.expires_at > now())
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_companion(uuid) TO authenticated, anon;
