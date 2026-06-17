-- =====================================================================
-- Premium audio library — the core paywalled asset (Hallow's model):
-- guided prayers, audio Scripture, sleep & rest, worship. A few free
-- samples act as the hook; the rest sit behind Companion.
--
-- audio_url is a CDN pointer the operator fills in with real/licensed
-- assets; the UI handles a null/unavailable URL gracefully.
-- Idempotent.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.audio_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  category text NOT NULL,            -- prayer | scripture | sleep | worship
  narrator text,
  duration_seconds int NOT NULL DEFAULT 0,
  audio_url text,                    -- CDN url; null = "coming soon"
  is_premium boolean NOT NULL DEFAULT true,
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audio_tracks_category_idx
  ON public.audio_tracks (category, sort);

GRANT SELECT ON public.audio_tracks TO anon, authenticated;
GRANT ALL ON public.audio_tracks TO service_role;
ALTER TABLE public.audio_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads audio catalog" ON public.audio_tracks
  FOR SELECT TO anon, authenticated USING (true);

-- Per-user resume position + completion (also feeds habit tracking).
CREATE TABLE IF NOT EXISTS public.audio_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.audio_tracks(id) ON DELETE CASCADE,
  position_seconds int NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);
GRANT SELECT, INSERT, UPDATE ON public.audio_progress TO authenticated;
GRANT ALL ON public.audio_progress TO service_role;
ALTER TABLE public.audio_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audio progress" ON public.audio_progress
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Seed catalog. Two free samples (the hook); the rest are Companion.
INSERT INTO public.audio_tracks
  (title, subtitle, category, narrator, duration_seconds, audio_url, is_premium, sort)
VALUES
  ('Morning Examen',        'Begin the day in stillness',        'prayer',    'Companion', 480,  NULL, false, 1),
  ('Psalm 23 — Read Aloud', 'The Lord is my shepherd',           'scripture', 'Companion', 180,  NULL, false, 2),
  ('Evening Compline',      'A prayer to close the day',         'prayer',    'Companion', 600,  NULL, true,  3),
  ('Be Still — 10 min',     'Guided breath & Scripture',         'prayer',    'Companion', 600,  NULL, true,  4),
  ('Sermon on the Mount',   'Matthew 5–7, narrated',             'scripture', 'Companion', 1500, NULL, true,  5),
  ('Sleep in His Peace',    'Scripture & soft sound for rest',   'sleep',     'Companion', 2400, NULL, true,  6),
  ('Rest — Psalms at Night','Psalms to quiet an anxious mind',   'sleep',     'Companion', 1800, NULL, true,  7),
  ('Be Thou My Vision',     'Instrumental hymn',                 'worship',   'Companion', 300,  NULL, true,  8),
  ('Great Is Thy Faithfulness','Instrumental hymn',              'worship',   'Companion', 320,  NULL, true,  9)
ON CONFLICT DO NOTHING;
