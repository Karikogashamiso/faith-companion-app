
-- 1) pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2) embedding column on verses (1536 dims = openai/text-embedding-3-small, under HNSW 2000-dim limit)
ALTER TABLE public.verses
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS embedded_at timestamptz;

CREATE INDEX IF NOT EXISTS verses_embedding_idx
  ON public.verses USING hnsw (embedding vector_cosine_ops);

-- 3) hybrid search function: combines full-text + vector, returns top-N candidates
CREATE OR REPLACE FUNCTION public.match_verses(
  query_embedding vector(1536),
  query_text text,
  p_version_id uuid,
  match_count int DEFAULT 12
) RETURNS TABLE (
  id bigint,
  book text,
  chapter int,
  verse int,
  text text,
  score double precision
)
LANGUAGE sql STABLE
SET search_path = public
AS $fn$
  WITH fts AS (
    SELECT v.id, v.book, v.chapter, v.verse, v.text,
      ts_rank(to_tsvector('english', v.text),
              websearch_to_tsquery('english', COALESCE(query_text,''))) AS s
    FROM public.verses v
    WHERE v.version_id = p_version_id
      AND query_text IS NOT NULL
      AND to_tsvector('english', v.text) @@ websearch_to_tsquery('english', query_text)
    ORDER BY s DESC
    LIMIT match_count * 4
  ),
  vec AS (
    SELECT v.id, v.book, v.chapter, v.verse, v.text,
      (1 - (v.embedding <=> query_embedding))::double precision AS s
    FROM public.verses v
    WHERE v.version_id = p_version_id
      AND query_embedding IS NOT NULL
      AND v.embedding IS NOT NULL
    ORDER BY v.embedding <=> query_embedding
    LIMIT match_count * 4
  ),
  merged AS (
    SELECT id, book, chapter, verse, text, s FROM fts
    UNION ALL
    SELECT id, book, chapter, verse, text, s FROM vec
  )
  SELECT id, book, chapter, verse, text, MAX(s) AS score
  FROM merged
  GROUP BY id, book, chapter, verse, text
  ORDER BY score DESC
  LIMIT match_count;
$fn$;

REVOKE EXECUTE ON FUNCTION public.match_verses(vector, text, uuid, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.match_verses(vector, text, uuid, int) TO authenticated, service_role;

-- 4) audit log
CREATE TABLE IF NOT EXISTS public.ai_study_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  tradition public.tradition NOT NULL,
  crisis_level text NOT NULL,
  retrieved_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  stripped_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  answer text NOT NULL,
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_study_logs TO authenticated;
GRANT ALL ON public.ai_study_logs TO service_role;
ALTER TABLE public.ai_study_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own ai logs" ON public.ai_study_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert own ai logs" ON public.ai_study_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 5) curated WEB seed (~30 verses, public domain — World English Bible)
WITH web AS (SELECT id FROM public.bible_versions WHERE abbreviation = 'WEB')
INSERT INTO public.verses (version_id, book, chapter, verse, text)
SELECT web.id, x.book, x.chapter, x.verse, x.text FROM web, (VALUES
  ('Philippians', 4, 6, $$In nothing be anxious, but in everything, by prayer and petition with thanksgiving, let your requests be made known to God.$$),
  ('Philippians', 4, 7, $$And the peace of God, which surpasses all understanding, will guard your hearts and your thoughts in Christ Jesus.$$),
  ('Matthew', 6, 25, $$Therefore I tell you, don't be anxious for your life: what you will eat, or what you will drink; nor yet for your body, what you will wear. Isn't life more than food, and the body more than clothing?$$),
  ('Matthew', 6, 26, $$See the birds of the sky, that they don't sow, neither do they reap, nor gather into barns. Your heavenly Father feeds them. Aren't you of much more value than they?$$),
  ('Matthew', 6, 27, $$Which of you, by being anxious, can add one moment to his lifespan?$$),
  ('1 Peter', 5, 7, $$casting all your worries on him, because he cares for you.$$),
  ('Psalms', 55, 22, $$Cast your burden on Yahweh and he will sustain you. He will never allow the righteous to be moved.$$),
  ('Psalms', 34, 17, $$The righteous cry, and Yahweh hears, and delivers them out of all their troubles.$$),
  ('Psalms', 34, 18, $$Yahweh is near to those who have a broken heart, and saves those who have a crushed spirit.$$),
  ('Matthew', 5, 4, $$Blessed are those who mourn, for they shall be comforted.$$),
  ('Revelation', 21, 4, $$He will wipe away every tear from their eyes. Death will be no more; neither will there be mourning, nor crying, nor pain any more. The first things have passed away.$$),
  ('2 Corinthians', 1, 3, $$Blessed be the God and Father of our Lord Jesus Christ, the Father of mercies and God of all comfort,$$),
  ('2 Corinthians', 1, 4, $$who comforts us in all our affliction, that we may be able to comfort those who are in any affliction, through the comfort with which we ourselves are comforted by God.$$),
  ('John', 11, 25, $$Jesus said to her, "I am the resurrection and the life. He who believes in me will still live, even if he dies."$$),
  ('John', 11, 26, $$Whoever lives and believes in me will never die. Do you believe this?$$),
  ('Jeremiah', 29, 11, $$For I know the thoughts that I think toward you, says Yahweh, thoughts of peace, and not of evil, to give you hope and a future.$$),
  ('Romans', 8, 28, $$We know that all things work together for good for those who love God, for those who are called according to his purpose.$$),
  ('Romans', 15, 13, $$Now may the God of hope fill you with all joy and peace in believing, that you may abound in hope in the power of the Holy Spirit.$$),
  ('Isaiah', 41, 10, $$Don't you be afraid, for I am with you. Don't be dismayed, for I am your God. I will strengthen you. Yes, I will help you. Yes, I will uphold you with the right hand of my righteousness.$$),
  ('Psalms', 139, 13, $$For you formed my inmost being. You knit me together in my mother's womb.$$),
  ('Psalms', 139, 14, $$I will give thanks to you, for I am fearfully and wonderfully made. Your works are wonderful. My soul knows that very well.$$),
  ('Psalms', 23, 1, $$Yahweh is my shepherd; I shall lack nothing.$$),
  ('Psalms', 23, 4, $$Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me. Your rod and your staff, they comfort me.$$),
  ('1 Corinthians', 13, 4, $$Love is patient and is kind. Love doesn't envy. Love doesn't brag, is not proud,$$),
  ('1 Corinthians', 13, 5, $$doesn't behave itself inappropriately, doesn't seek its own way, is not provoked, takes no account of evil;$$),
  ('1 Corinthians', 13, 6, $$doesn't rejoice in unrighteousness, but rejoices with the truth;$$),
  ('1 Corinthians', 13, 7, $$bears all things, believes all things, hopes all things, endures all things.$$),
  ('John', 3, 16, $$For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life.$$),
  ('Romans', 5, 8, $$But God commends his own love toward us, in that while we were yet sinners, Christ died for us.$$),
  ('Ephesians', 2, 8, $$for by grace you have been saved through faith, and that not of yourselves; it is the gift of God,$$),
  ('Ephesians', 2, 9, $$not of works, that no one would boast.$$),
  ('James', 2, 17, $$Even so faith, if it has no works, is dead in itself.$$),
  ('James', 2, 24, $$You see then that by works a man is justified, and not only by faith.$$),
  ('James', 2, 26, $$For as the body apart from the spirit is dead, even so faith apart from works is dead.$$),
  ('Romans', 3, 28, $$We maintain therefore that a man is justified by faith apart from the works of the law.$$),
  ('Acts', 2, 38, $$Peter said to them, Repent, and be baptized, every one of you, in the name of Jesus Christ for the forgiveness of sins, and you will receive the gift of the Holy Spirit.$$),
  ('1 Peter', 3, 21, $$This is a symbol of baptism, which now saves you—not the putting away of the filth of the flesh, but the answer of a good conscience toward God, through the resurrection of Jesus Christ.$$)
) AS x(book, chapter, verse, text)
ON CONFLICT (version_id, book, chapter, verse) DO NOTHING;
