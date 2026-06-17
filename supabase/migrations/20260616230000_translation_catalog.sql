-- =====================================================================
-- Bible translation catalog: the common public-domain translations across
-- traditions (Protestant + Catholic). Copyrighted versions (NIV/ESV/NLT/…)
-- are intentionally NOT seeded — they require a publisher license; add them
-- the same way once licensed. Idempotent.
-- =====================================================================

-- Make abbreviation unique so the catalog upserts cleanly.
CREATE UNIQUE INDEX IF NOT EXISTS bible_versions_abbr_uniq
  ON public.bible_versions (abbreviation);

INSERT INTO public.bible_versions (name, abbreviation, language, license_notes, is_public_domain)
VALUES
  ('World English Bible',        'WEB', 'en', 'Public domain',                 true),
  ('King James Version',         'KJV', 'en', 'Public domain (1769)',          true),
  ('American Standard Version',  'ASV', 'en', 'Public domain (1901)',          true),
  ('Young''s Literal Translation','YLT','en', 'Public domain',                 true),
  ('Bible in Basic English',     'BBE', 'en', 'Public domain',                 true),
  ('Douay-Rheims (Catholic)',    'DRA', 'en', 'Public domain (Catholic canon)',true)
ON CONFLICT (abbreviation) DO NOTHING;

-- Only translations that actually have verse text should appear in pickers,
-- so seeded-but-not-yet-ingested versions stay hidden until populated.
CREATE OR REPLACE FUNCTION public.versions_with_content()
RETURNS TABLE (id uuid, name text, abbreviation text, language text)
LANGUAGE sql STABLE SET search_path = public AS $fn$
  SELECT v.id, v.name, v.abbreviation, v.language
  FROM public.bible_versions v
  WHERE EXISTS (SELECT 1 FROM public.verses x WHERE x.version_id = v.id)
  ORDER BY v.abbreviation;
$fn$;
REVOKE EXECUTE ON FUNCTION public.versions_with_content() FROM public;
GRANT EXECUTE ON FUNCTION public.versions_with_content() TO anon, authenticated, service_role;
