-- =====================================================================
-- Audio library admin: let admins manage the catalog from the app and upload
-- audio files to a public Storage bucket. Reads stay open (catalog is public);
-- writes are admin-only via has_role. Idempotent.
-- =====================================================================

-- Catalog writes for admins (reads already public via the existing policy).
GRANT INSERT, UPDATE, DELETE ON public.audio_tracks TO authenticated;
DROP POLICY IF EXISTS "admins manage audio catalog" ON public.audio_tracks;
CREATE POLICY "admins manage audio catalog" ON public.audio_tracks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Public Storage bucket for audio assets (public read so audio_url is playable).
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio', 'audio', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage object policies: world-readable, admin-writable.
DROP POLICY IF EXISTS "public reads audio bucket" ON storage.objects;
CREATE POLICY "public reads audio bucket" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'audio');

DROP POLICY IF EXISTS "admins upload audio" ON storage.objects;
CREATE POLICY "admins upload audio" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'audio' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins update audio" ON storage.objects;
CREATE POLICY "admins update audio" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'audio' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'audio' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins delete audio" ON storage.objects;
CREATE POLICY "admins delete audio" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'audio' AND public.has_role(auth.uid(), 'admin'));
