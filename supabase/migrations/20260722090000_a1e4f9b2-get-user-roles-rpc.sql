-- Module 3 (Global Authentication — RBAC foundation)
--
-- Adds a get_user_roles() RPC so the client can fetch ALL of a user's roles
-- in one call, instead of calling has_role() once per possible enum value.
-- This is additive only — it does not alter user_roles, app_role, or
-- has_role(), all of which already exist. See
-- docs/architecture/GLOBAL_AUTH_RBAC.md for the full module writeup,
-- including a documented gap this migration does NOT fix: the
-- supabase/migrations/ history has no baseline migration that creates
-- app_role/user_roles (or most other core tables) — they predate this
-- migrations folder. That is a separate, larger reconciliation effort
-- requiring a live `supabase db dump` against the actual project, which
-- cannot be safely done from this sandbox — flagged, not silently patched.

CREATE OR REPLACE FUNCTION public.get_user_roles(p_user uuid)
RETURNS public.app_role[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(ur.role ORDER BY ur.role), ARRAY[]::public.app_role[])
  FROM public.user_roles ur
  WHERE ur.user_id = p_user;
$$;

ALTER FUNCTION public.get_user_roles(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.get_user_roles(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_roles(uuid) TO anon, authenticated, service_role;
