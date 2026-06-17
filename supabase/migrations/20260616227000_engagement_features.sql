-- =====================================================================
-- Engagement features: personal prayer list, bookmarks/collections, and
-- verse memorization (spaced repetition). All user-scoped, RLS own-rows.
-- Idempotent.
-- =====================================================================

-- ---- Personal prayer list (private; complements the public wall) --------
CREATE TABLE IF NOT EXISTS public.personal_prayers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  answered boolean NOT NULL DEFAULT false,
  answered_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz
);
CREATE INDEX IF NOT EXISTS personal_prayers_user_idx
  ON public.personal_prayers (user_id, answered, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_prayers TO authenticated;
GRANT ALL ON public.personal_prayers TO service_role;
ALTER TABLE public.personal_prayers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own personal prayers" ON public.personal_prayers
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---- Bookmarks & collections (extends highlights) -----------------------
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verse_id bigint NOT NULL REFERENCES public.verses(id) ON DELETE CASCADE,
  collection text NOT NULL DEFAULT 'Saved',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, verse_id, collection)
);
CREATE INDEX IF NOT EXISTS bookmarks_user_idx
  ON public.bookmarks (user_id, collection, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookmarks TO authenticated;
GRANT ALL ON public.bookmarks TO service_role;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bookmarks" ON public.bookmarks
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---- Verse memorization (spaced repetition; the retention moat) ---------
-- Snapshots ref + text so a memorized verse is stable even if the user
-- later switches translation.
CREATE TABLE IF NOT EXISTS public.memory_verses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verse_ref text NOT NULL,
  verse_text text NOT NULL,
  stage int NOT NULL DEFAULT 0,
  due_at date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE (user_id, verse_ref)
);
CREATE INDEX IF NOT EXISTS memory_verses_due_idx
  ON public.memory_verses (user_id, due_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory_verses TO authenticated;
GRANT ALL ON public.memory_verses TO service_role;
ALTER TABLE public.memory_verses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own memory verses" ON public.memory_verses
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
