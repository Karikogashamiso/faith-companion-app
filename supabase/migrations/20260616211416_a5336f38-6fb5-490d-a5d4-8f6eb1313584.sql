
-- Add active_plan to groups
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS active_plan_id uuid REFERENCES public.reading_plans(id) ON DELETE SET NULL;

-- Per-user opt-in progress sharing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS share_progress boolean NOT NULL DEFAULT false;

-- Prayer request testimony & answered_at
ALTER TABLE public.prayer_requests ADD COLUMN IF NOT EXISTS testimony text;
ALTER TABLE public.prayer_requests ADD COLUMN IF NOT EXISTS answered_at timestamptz;

-- Notification log for rate limiting
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,           -- e.g. 'prayer_followup', 'plan_nudge'
  target_id uuid,               -- e.g. prayer_request id
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notification_logs_user_kind_idx
  ON public.notification_logs(user_id, kind, sent_at DESC);

GRANT SELECT, INSERT ON public.notification_logs TO authenticated;
GRANT ALL ON public.notification_logs TO service_role;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own notifications"
  ON public.notification_logs FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "user inserts own notifications"
  ON public.notification_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Allow group members to see each other's profile basics (display_name + share_progress opt-in)
-- Use a security definer function rather than broadening profiles RLS
CREATE OR REPLACE FUNCTION public.shares_group_with(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members m1
    JOIN public.group_members m2 ON m1.group_id = m2.group_id
    WHERE m1.user_id = _a AND m2.user_id = _b
  );
$$;

-- Join-by-code RPC: bypasses select RLS so non-members can find the group
CREATE OR REPLACE FUNCTION public.join_group_by_code(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_group_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT id INTO v_group_id FROM public.groups WHERE upper(join_code) = upper(_code);
  IF v_group_id IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;
  INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (v_group_id, auth.uid(), 'member')
    ON CONFLICT (group_id, user_id) DO NOTHING;
  RETURN v_group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_group_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_group_with(uuid, uuid) TO authenticated;

-- Ensure unique (group_id, user_id) for ON CONFLICT
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'group_members_group_user_unique'
  ) THEN
    ALTER TABLE public.group_members
      ADD CONSTRAINT group_members_group_user_unique UNIQUE (group_id, user_id);
  END IF;
END $$;
