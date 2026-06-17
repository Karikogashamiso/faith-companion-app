-- =====================================================================
-- "Explain this chapter" — cache of AI chapter summaries, shared across all
-- users (they're general, not personal), so each chapter is generated once.
-- Public read; writes happen server-side via the service role. Idempotent.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.chapter_summaries (
  version_id uuid NOT NULL REFERENCES public.bible_versions(id) ON DELETE CASCADE,
  book text NOT NULL,
  chapter int NOT NULL,
  summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (version_id, book, chapter)
);
GRANT SELECT ON public.chapter_summaries TO anon, authenticated;
GRANT ALL ON public.chapter_summaries TO service_role;
ALTER TABLE public.chapter_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads chapter summaries" ON public.chapter_summaries
  FOR SELECT TO anon, authenticated USING (true);
