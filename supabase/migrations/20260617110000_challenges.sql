-- =====================================================================
-- Multi-day community challenges — the niche's #1 growth/retention engine
-- (Hallow's Pray40/Pray25). A challenge has ordered daily content; users join,
-- complete a day at a time (feeding the streak), and see how many are praying
-- alongside them. Self-paced. Idempotent.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text,
  description text,
  day_count int NOT NULL DEFAULT 7,
  accent text,                 -- 'gold' | 'indigo' (UI hint)
  is_active boolean NOT NULL DEFAULT true,
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.challenges TO anon, authenticated;
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone reads active challenges" ON public.challenges;
CREATE POLICY "anyone reads active challenges" ON public.challenges
  FOR SELECT TO anon, authenticated USING (is_active);

CREATE TABLE IF NOT EXISTS public.challenge_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  day_number int NOT NULL,
  title text NOT NULL,
  scripture_ref text,
  prompt text,
  prayer text,
  UNIQUE (challenge_id, day_number)
);
GRANT SELECT ON public.challenge_days TO anon, authenticated;
GRANT ALL ON public.challenge_days TO service_role;
ALTER TABLE public.challenge_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone reads challenge days" ON public.challenge_days;
CREATE POLICY "anyone reads challenge days" ON public.challenge_days
  FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.challenge_participants (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_completed_day int NOT NULL DEFAULT 0,
  completed_at timestamptz,
  PRIMARY KEY (user_id, challenge_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_participants TO authenticated;
GRANT ALL ON public.challenge_participants TO service_role;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own challenge participation" ON public.challenge_participants;
CREATE POLICY "own challenge participation" ON public.challenge_participants
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Public participant count (social proof) without exposing who participates.
CREATE OR REPLACE FUNCTION public.challenge_participant_count(_challenge_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT count(*)::int FROM public.challenge_participants WHERE challenge_id = _challenge_id;
$fn$;
GRANT EXECUTE ON FUNCTION public.challenge_participant_count(uuid) TO anon, authenticated, service_role;

-- ---- Seed: two short, evergreen challenges ----
INSERT INTO public.challenges (slug, title, subtitle, description, day_count, accent, sort)
VALUES
  ('peace-7', '7 Days of Peace', 'Trade anxiety for trust', 'A week in Scripture for an anxious heart — one short reading, reflection, and prayer each day.', 7, 'indigo', 1),
  ('gratitude-5', '5 Days of Gratitude', 'Learn to give thanks', 'Five days to retrain your heart toward thankfulness, whatever the season.', 5, 'gold', 2)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.challenge_days (challenge_id, day_number, title, scripture_ref, prompt, prayer)
SELECT c.id, d.day_number, d.title, d.scripture_ref, d.prompt, d.prayer
FROM public.challenges c
JOIN (VALUES
  ('peace-7', 1, 'Do not be anxious', 'Philippians 4:6-7', 'Name the worry that is heaviest today. What would it look like to hand it to God right now?', 'Father, I bring you what I have been carrying. Guard my heart and mind with your peace.'),
  ('peace-7', 2, 'Cast your cares', '1 Peter 5:7', 'List three things you are anxious about. Pray each one back to God, palms open.', 'Lord, I cast my cares on you, because you care for me.'),
  ('peace-7', 3, 'Be still', 'Psalm 46:10', 'Sit in silence for two minutes. Let "Be still, and know that I am God" be your only thought.', 'God, quiet the noise in me. Help me know that you are God, and I am not.'),
  ('peace-7', 4, 'Seek first', 'Matthew 6:33-34', 'What are you chasing for security? Ask God to reorder your wants today.', 'Jesus, I seek first your kingdom. Provide for today; I trust you with tomorrow.'),
  ('peace-7', 5, 'The Lord is near', 'Psalm 145:18', 'Where do you most need to feel God''s nearness? Tell him.', 'Lord, you are near to all who call on you. Draw close to me now.'),
  ('peace-7', 6, 'Peace I leave with you', 'John 14:27', 'Receive Christ''s peace as a gift, not something you must produce. Breathe it in.', 'Jesus, your peace, not the world''s — let it rule in me today.'),
  ('peace-7', 7, 'Rest in him', 'Matthew 11:28-30', 'Look back over the week. Where did God meet you? Thank him and rest.', 'Lord, I come to you weary. Thank you for rest. Carry me into this next week.'),
  ('gratitude-5', 1, 'Give thanks', '1 Thessalonians 5:18', 'Write down five things you are grateful for, however small.', 'Father, thank you. Open my eyes to your goodness everywhere today.'),
  ('gratitude-5', 2, 'His love endures', 'Psalm 136:1', 'Recall a time God was faithful to you. Thank him specifically for it.', 'Lord, your love endures forever. Thank you for your faithfulness to me.'),
  ('gratitude-5', 3, 'Every good gift', 'James 1:17', 'Name a good gift in your life you have been treating as ordinary.', 'Giver of every good gift, forgive my forgetfulness. I receive your kindness with thanks.'),
  ('gratitude-5', 4, 'In all circumstances', 'Philippians 4:11-13', 'What hard thing can you still thank God in (not necessarily for)?', 'God, teach me contentment. I can do all things through Christ who strengthens me.'),
  ('gratitude-5', 5, 'Bless the Lord', 'Psalm 103:1-5', 'Bless God for who he is, not just what he gives. Praise him from your whole heart.', 'Bless the Lord, O my soul, and forget not all his benefits.')
) AS d(slug, day_number, title, scripture_ref, prompt, prayer)
  ON d.slug = c.slug
ON CONFLICT (challenge_id, day_number) DO NOTHING;
