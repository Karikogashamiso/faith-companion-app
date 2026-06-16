
CREATE TABLE IF NOT EXISTS public.onboarding_answers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  goal text,                        -- 'grow_faith' | 'understand_bible' | 'peace_anxiety' | 'habit' | 'reconnect'
  journey_stage text,               -- 'new' | 'returning' | 'deeper' | 'leading'
  struggles text[] NOT NULL DEFAULT '{}',  -- multi-select chips
  daily_minutes int,                -- 3 | 5 | 10 | 15
  reminder_time time,               -- local-ish HH:MM
  join_code text,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.onboarding_answers TO authenticated;
GRANT ALL ON public.onboarding_answers TO service_role;
ALTER TABLE public.onboarding_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own onboarding" ON public.onboarding_answers
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user inserts own onboarding" ON public.onboarding_answers
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "user updates own onboarding" ON public.onboarding_answers
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_onboarding_answers_updated_at
  BEFORE UPDATE ON public.onboarding_answers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_minutes int,
  ADD COLUMN IF NOT EXISTS reminder_time time;
