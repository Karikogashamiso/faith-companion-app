ALTER TABLE public.bible_versions ADD COLUMN IF NOT EXISTS api_bible_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bible_versions_abbreviation_key'
  ) THEN
    ALTER TABLE public.bible_versions
      ADD CONSTRAINT bible_versions_abbreviation_key UNIQUE (abbreviation);
  END IF;
END$$;

INSERT INTO public.bible_versions (abbreviation, name, language, is_public_domain, license_notes, api_bible_id) VALUES
  ('KJV','King James Version','en',true,'Public domain. Rendered from API.Bible cache.','de4e12af7f1f3f3d-01'),
  ('WEB','World English Bible','en',true,'Public domain. Ingested locally.','9879dbb7cfe39e4d-01'),
  ('ASV','American Standard Version','en',true,'Public domain. Rendered from API.Bible cache.','685d1470fe4d5c3b-01'),
  ('BBE','Bible in Basic English','en',true,'Public domain. Coming soon.', NULL),
  ('YLT','Young''s Literal Translation','en',true,'Public domain. Coming soon.', NULL),
  ('DBY','Darby Translation','en',true,'Public domain. Coming soon.', NULL),
  ('WBT','Webster''s Bible Translation','en',true,'Public domain. Coming soon.', NULL),
  ('AKJV','American King James Version','en',true,'Public domain. Coming soon.', NULL)
ON CONFLICT (abbreviation) DO UPDATE SET
  name = EXCLUDED.name,
  language = EXCLUDED.language,
  is_public_domain = EXCLUDED.is_public_domain,
  license_notes = EXCLUDED.license_notes,
  api_bible_id = COALESCE(EXCLUDED.api_bible_id, public.bible_versions.api_bible_id);