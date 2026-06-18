-- =====================================================================
-- Stripe web billing: add a reconciliation column so the Stripe webhook can
-- map subscription events (which only carry a Stripe customer id) back to a
-- Supabase user. Mirrors the existing rc_app_user_id used for RevenueCat.
--
-- The entitlements table already exists (20260616212102) and is writable only
-- by service_role; the Stripe webhook and checkout server fns use the admin
-- client, so no new RLS policy is required. Idempotent.
-- =====================================================================

ALTER TABLE public.entitlements
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

CREATE UNIQUE INDEX IF NOT EXISTS entitlements_stripe_customer_uniq
  ON public.entitlements (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
