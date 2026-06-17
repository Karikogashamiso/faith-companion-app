-- =====================================================================
-- Phase 4: a global "pray together" wall — public prayer requests anyone can
-- pray for in real time (the community stickiness lever). author_name is
-- snapshotted at post time so we never need to expose other users' profiles.
-- The prayed counter is incremented only through an atomic SECURITY DEFINER
-- RPC, so it can't be inflated from the client. Idempotent.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.global_prayers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT 'Anonymous',
  body text NOT NULL,
  prayed_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS global_prayers_feed_idx
  ON public.global_prayers (status, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.global_prayers TO authenticated;
GRANT ALL ON public.global_prayers TO service_role;
ALTER TABLE public.global_prayers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read open prayers" ON public.global_prayers
  FOR SELECT TO authenticated
  USING (status = 'open' OR author_id = auth.uid());
CREATE POLICY "post own prayer" ON public.global_prayers
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "delete own prayer" ON public.global_prayers
  FOR DELETE TO authenticated USING (author_id = auth.uid());
-- No client UPDATE: prayed_count moves only via the RPC below.

CREATE TABLE IF NOT EXISTS public.global_prayer_prayed (
  prayer_id uuid NOT NULL REFERENCES public.global_prayers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (prayer_id, user_id)
);
GRANT SELECT ON public.global_prayer_prayed TO authenticated;
GRANT ALL ON public.global_prayer_prayed TO service_role;
ALTER TABLE public.global_prayer_prayed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own prayed" ON public.global_prayer_prayed
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Atomic, idempotent "I prayed for this": records the prayer once and bumps
-- the counter under a row lock. Returns the new total.
CREATE OR REPLACE FUNCTION public.pray_for_global(_prayer_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_new boolean;
  v_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  INSERT INTO public.global_prayer_prayed (prayer_id, user_id)
    VALUES (_prayer_id, v_uid)
    ON CONFLICT (prayer_id, user_id) DO NOTHING;
  GET DIAGNOSTICS v_new = ROW_COUNT;

  IF v_new THEN
    UPDATE public.global_prayers
      SET prayed_count = prayed_count + 1
      WHERE id = _prayer_id
      RETURNING prayed_count INTO v_count;
  ELSE
    SELECT prayed_count INTO v_count FROM public.global_prayers WHERE id = _prayer_id;
  END IF;

  RETURN COALESCE(v_count, 0);
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.pray_for_global(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.pray_for_global(uuid) TO authenticated;
