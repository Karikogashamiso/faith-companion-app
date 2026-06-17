-- =====================================================================
-- Expand the translation catalog with the 8 most popular Bible translations
-- in the Christian world (flagship: World English Bible).
--
-- Two tiers:
--   • PUBLIC DOMAIN  — shippable now; load text with scripts/ingest-web-bible.mjs.
--   • LICENSED       — catalogued and ready to enable, but text may NOT be
--                      loaded without a signed publisher agreement. These rows
--                      stay hidden in pickers until verses exist
--                      (see public.versions_with_content), so they never
--                      surface empty.
--
-- Idempotent: relies on the unique abbreviation index from the catalog
-- migration and ON CONFLICT DO NOTHING.
-- =====================================================================

INSERT INTO public.bible_versions (name, abbreviation, language, license_notes, is_public_domain)
VALUES
  -- Ship now (public domain) — round out the popular free lineup.
  ('World English Bible, British & Catholic Edition', 'WEBBE', 'en',
     'Public domain (includes Deuterocanon)', true),
  ('Darby Translation',          'DBY', 'en', 'Public domain (1890)', true),

  -- Most-requested modern translations — LICENSED. Loading their text
  -- requires a signed agreement with the publisher named below.
  ('New International Version',   'NIV',  'en', 'Licensed — Biblica / Zondervan',        false),
  ('English Standard Version',    'ESV',  'en', 'Licensed — Crossway',                   false),
  ('New Living Translation',      'NLT',  'en', 'Licensed — Tyndale House',              false),
  ('New King James Version',      'NKJV', 'en', 'Licensed — Thomas Nelson (HarperCollins)', false),
  ('New American Standard Bible', 'NASB', 'en', 'Licensed — The Lockman Foundation',     false),
  ('Christian Standard Bible',    'CSB',  'en', 'Licensed — Holman / Lifeway',           false)
ON CONFLICT (abbreviation) DO NOTHING;
