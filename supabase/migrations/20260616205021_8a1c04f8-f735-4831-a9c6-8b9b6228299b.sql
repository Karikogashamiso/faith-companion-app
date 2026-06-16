
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_request(uuid, uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_owner_as_member() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM public, anon, authenticated;
