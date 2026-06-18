-- =====================================================================
-- Web push: store browser push subscriptions and make reminders deliverable
-- when the app is CLOSED. The in-app ReminderScheduler covers the open-app
-- case; a scheduled job (/api/cron/push-due) sends to these subscriptions.
--
-- Reminders gain a timezone (so the server knows when "07:30" is for each
-- user) and a per-day dedupe marker. Idempotent.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "own push subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Per-reminder timezone (IANA, e.g. 'America/New_York') + last delivery date
-- (in that timezone) so the cron sends once per day at/after the local time.
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS tz text NOT NULL DEFAULT 'UTC';
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS last_pushed_on date;
