-- =====================================================================
-- Reminders / alarms: multiple per-user verse & prayer reminder times with
-- day-of-week scheduling. Stored server-side so they're ready for push
-- delivery; the client also fires in-app notifications while open. RLS own.
-- Idempotent.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'prayer' CHECK (kind IN ('verse', 'prayer')),
  label text NOT NULL DEFAULT '',
  at_time time NOT NULL,
  days int[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',  -- 0=Sun … 6=Sat
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reminders_user_idx
  ON public.reminders (user_id, enabled);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reminders" ON public.reminders
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
