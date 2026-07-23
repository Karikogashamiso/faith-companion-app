
-- Seed starter reading plans if none exist. Idempotent by title.
DO $$
DECLARE
  v_peace uuid;
  v_john  uuid;
  v_psalm uuid;
  i int;
BEGIN
  -- 7-day Peace in Anxiety
  SELECT id INTO v_peace FROM public.reading_plans WHERE title = 'Peace in Anxiety';
  IF v_peace IS NULL THEN
    INSERT INTO public.reading_plans (title, description, tradition, day_count, is_premium)
    VALUES ('Peace in Anxiety', 'A gentle seven-day walk through Scripture on worry, rest, and God''s nearness.',
            'unspecified', 7, false)
    RETURNING id INTO v_peace;

    INSERT INTO public.plan_days (plan_id, day_number, passage_ref, reflection_md, prayer_md) VALUES
      (v_peace, 1, 'Philippians 4:4-9',   'Where is worry crowding out gratitude today?', 'Lord, teach me to bring every anxious thought to You.'),
      (v_peace, 2, 'Matthew 6:25-34',      'What does it mean that today has enough trouble of its own?', 'Father, help me trust You for today.'),
      (v_peace, 3, 'Psalm 23',             'Which line of the Shepherd''s song do you most need?',           'Shepherd me through this valley.'),
      (v_peace, 4, '1 Peter 5:6-11',       'What weight are you invited to cast on Him right now?',           'I cast my cares on You — hold them for me.'),
      (v_peace, 5, 'Isaiah 41:10',         'Sit with the phrase: "Do not fear, for I am with you."',         'God, be near when fear crowds in.'),
      (v_peace, 6, 'John 14:25-27',        'What does the peace Jesus gives look like in your day?',          'Jesus, let Your peace guard my heart.'),
      (v_peace, 7, 'Psalm 46',             'Name one place you need to be still and know.',                   'You are God. I am not. Thank You.');
  END IF;

  -- 14-day Gospel of John — Introduction
  SELECT id INTO v_john FROM public.reading_plans WHERE title = 'Meet Jesus in John';
  IF v_john IS NULL THEN
    INSERT INTO public.reading_plans (title, description, tradition, day_count, is_premium)
    VALUES ('Meet Jesus in John', 'Fourteen days in the Gospel of John — begin here to meet Jesus for yourself.',
            'unspecified', 14, false)
    RETURNING id INTO v_john;

    FOR i IN 1..14 LOOP
      INSERT INTO public.plan_days (plan_id, day_number, passage_ref, reflection_md, prayer_md) VALUES (
        v_john, i,
        'John ' || i,
        'What does today''s chapter reveal about who Jesus is?',
        'Jesus, help me see You more clearly today.'
      );
    END LOOP;
  END IF;

  -- 30-day Psalms Daily
  SELECT id INTO v_psalm FROM public.reading_plans WHERE title = 'Psalms Daily';
  IF v_psalm IS NULL THEN
    INSERT INTO public.reading_plans (title, description, tradition, day_count, is_premium)
    VALUES ('Psalms Daily', 'A month of Psalms — one honest prayer a day, in every season.',
            'unspecified', 30, false)
    RETURNING id INTO v_psalm;

    FOR i IN 1..30 LOOP
      INSERT INTO public.plan_days (plan_id, day_number, passage_ref, reflection_md, prayer_md) VALUES (
        v_psalm, i,
        'Psalm ' || i,
        'Which line of this psalm speaks to your today?',
        'Give me words for what I cannot say.'
      );
    END LOOP;
  END IF;
END $$;
