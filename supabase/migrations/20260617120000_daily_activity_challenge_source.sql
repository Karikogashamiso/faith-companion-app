-- =====================================================================
-- Allow 'challenge' as a daily_activity source so completing a challenge day
-- counts toward the streak (the daily_activity_source_chk CHECK previously
-- rejected it, silently dropping the streak credit). Idempotent.
-- =====================================================================

ALTER TABLE public.daily_activity DROP CONSTRAINT IF EXISTS daily_activity_source_chk;
ALTER TABLE public.daily_activity
  ADD CONSTRAINT daily_activity_source_chk
  CHECK (source IN ('home','reader','plan','widget','prayer','search','challenge')) NOT VALID;
