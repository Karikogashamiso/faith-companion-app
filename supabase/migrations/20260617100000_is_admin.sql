-- =====================================================================
-- Fix admin gating from client/authenticated contexts. has_role() execute was
-- (intentionally) revoked from authenticated, so direct client/server-fn calls
-- to has_role fail with permission-denied — locking real admins out of the
-- audio admin page and the embedVerses job.
--
-- Add a self-scoped is_admin() (only checks the CALLER via auth.uid()), which is
-- safe to expose to authenticated and leaks nothing about other users.
-- SECURITY DEFINER so it can call has_role internally. Idempotent.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT public.has_role(auth.uid(), 'admin');
$fn$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
