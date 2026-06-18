-- =====================================================================
-- Close the AI cost bypass: explainChapter and dailyDevotional gate on
-- ai_enabled but never metered, so a user could trigger many distinct
-- (uncached) generations and run up gateway cost.
--
-- We add a SEPARATE, generous daily counter for these auxiliary generations
-- (distinct from the 5/day study allowance, so reading help doesn't burn study
-- sessions). Companions are unlimited. Tamper-proof: writes are server-only and
-- happen exclusively through the atomic, row-locked RPC — mirrors
-- consume_ai_session. Idempotent.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.ai_aux_usage_daily (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);
GRANT SELECT ON public.ai_aux_usage_daily TO authenticated;
GRANT ALL ON public.ai_aux_usage_daily TO service_role;
ALTER TABLE public.ai_aux_usage_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user reads own aux usage" ON public.ai_aux_usage_daily;
CREATE POLICY "user reads own aux usage" ON public.ai_aux_usage_daily
  FOR SELECT USING (user_id = auth.uid());
-- No INSERT/UPDATE policies for authenticated → only the RPC (definer) writes.

CREATE OR REPLACE FUNCTION public.consume_ai_generation(_limit int DEFAULT 30)
RETURNS TABLE (allowed boolean, used int, day_limit int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_used int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _limit IS NULL OR _limit < 0 THEN _limit := 30; END IF;

  -- Companions are unlimited; never touch the counter for them.
  IF public.is_companion(v_uid) THEN
    RETURN QUERY SELECT true, 0, _limit;
    RETURN;
  END IF;

  INSERT INTO public.ai_aux_usage_daily (user_id, usage_date, count)
    VALUES (v_uid, current_date, 0)
    ON CONFLICT (user_id, usage_date) DO NOTHING;

  SELECT count INTO v_used
    FROM public.ai_aux_usage_daily
    WHERE user_id = v_uid AND usage_date = current_date
    FOR UPDATE;

  IF v_used >= _limit THEN
    RETURN QUERY SELECT false, v_used, _limit;
    RETURN;
  END IF;

  UPDATE public.ai_aux_usage_daily
    SET count = count + 1
    WHERE user_id = v_uid AND usage_date = current_date
    RETURNING count INTO v_used;

  RETURN QUERY SELECT true, v_used, _limit;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.consume_ai_generation(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_generation(int) TO authenticated, service_role;
