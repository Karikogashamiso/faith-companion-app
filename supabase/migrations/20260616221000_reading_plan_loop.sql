-- =====================================================================
-- Reading-plan loop: an individual "active plan" pointer + seeded starter
-- plans so the daily core loop works end to end. Idempotent.
-- =====================================================================

-- Individual active plan (groups already have active_plan_id; users didn't).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_plan_id uuid
  REFERENCES public.reading_plans(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- Free starter plan — "Finding Peace in Anxious Times" (7 days), built
-- entirely from verses already seeded so passages always resolve.
-- ---------------------------------------------------------------------
INSERT INTO public.reading_plans (id, title, description, tradition, day_count, is_premium)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'Finding Peace in Anxious Times',
  'A gentle 7-day walk through Scripture''s words on worry, provision, and the peace of God.',
  NULL, 7, false
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.plan_days (plan_id, day_number, passage_ref, reflection_md, prayer_md)
VALUES
  ('11111111-1111-4111-8111-111111111111', 1, 'Philippians 4:6-7',
   'Anxiety asks us to carry tomorrow today. Paul offers another way: bring it to God in prayer, with thanksgiving, and receive a peace that outruns understanding.',
   'Lord, I bring you what I am carrying. Trade my worry for your peace today.'),
  ('11111111-1111-4111-8111-111111111111', 2, 'Matthew 6:25-27',
   'Jesus points to the birds — fed without striving. You are worth more. Worry adds nothing; trust adds rest.',
   'Father, remind me of my worth to you, and quiet my striving.'),
  ('11111111-1111-4111-8111-111111111111', 3, '1 Peter 5:7',
   'Casting is an action — a deliberate throwing of your cares onto One strong enough to hold them. He cares for you.',
   'I cast my cares on you, because you care for me.'),
  ('11111111-1111-4111-8111-111111111111', 4, 'Psalms 34:17-18',
   'God is not distant from the broken-hearted. He is near, and he hears. Your cry is not unheard.',
   'Draw near to me today, Lord. Let me know you are close.'),
  ('11111111-1111-4111-8111-111111111111', 5, 'Isaiah 41:10',
   'Three promises against fear: I am with you, I will strengthen you, I will uphold you. Lean on them.',
   'When fear rises, steady me with your right hand.'),
  ('11111111-1111-4111-8111-111111111111', 6, 'Romans 8:28',
   'Not that all things ARE good — but that God works in all things for good for those who love him. Nothing is wasted.',
   'Work even this for good, Lord. I trust your purpose.'),
  ('11111111-1111-4111-8111-111111111111', 7, 'Romans 15:13',
   'A closing blessing: may the God of hope fill you with joy and peace as you trust him, so hope overflows.',
   'God of hope, fill me, that I might overflow to others.')
ON CONFLICT (plan_id, day_number) DO NOTHING;

-- ---------------------------------------------------------------------
-- Premium plan — "The Heart of the Gospel" (5 days). Demonstrates the
-- gated/Companion path in the picker.
-- ---------------------------------------------------------------------
INSERT INTO public.reading_plans (id, title, description, tradition, day_count, is_premium)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  'The Heart of the Gospel',
  'Five days through grace, faith, and love — the foundation of the Christian hope.',
  NULL, 5, true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.plan_days (plan_id, day_number, passage_ref, reflection_md, prayer_md)
VALUES
  ('22222222-2222-4222-8222-222222222222', 1, 'John 3:16',
   'The gospel in one sentence: love that gives, so that whoever believes might live.',
   'Thank you for loving the world — and me — enough to give.'),
  ('22222222-2222-4222-8222-222222222222', 2, 'Romans 5:8',
   'Not after we cleaned ourselves up — while we were still sinners, Christ died. Grace meets us as we are.',
   'I receive your love that came before I deserved it.'),
  ('22222222-2222-4222-8222-222222222222', 3, 'Ephesians 2:8-9',
   'Saved by grace through faith — a gift, not a wage. There is nothing to boast in but the Giver.',
   'I stop earning. I simply receive your gift today.'),
  ('22222222-2222-4222-8222-222222222222', 4, '1 Corinthians 13:4-7',
   'The love that saved us is the love we are called to live: patient, kind, enduring all things.',
   'Make your love in me patient and kind toward others.'),
  ('22222222-2222-4222-8222-222222222222', 5, 'James 2:17',
   'Faith that is alive moves. Grace received becomes grace expressed in how we live.',
   'Let my faith show up in my hands and feet this week.')
ON CONFLICT (plan_id, day_number) DO NOTHING;
