ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_version_id uuid REFERENCES public.bible_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notification_time time;