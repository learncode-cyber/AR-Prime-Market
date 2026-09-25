import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface AuthenticatedUser {
  userId: string;
  claims: Record<string, unknown>;
  /** A request-scoped Supabase client authenticated as this user (respects RLS). */
  supabase: ReturnType<typeof createClient<Database>>;
}

/**
 * Authenticates a raw Request via its `Authorization: Bearer <token>` header.
 *
 * This exists because `src/routes/api/*.ts` handlers (TanStack Start's
 * `server.handlers` on a file route) receive a raw `Request`/`Response`
 * pair — they are NOT `createServerFn` calls, so the auto-generated
 * `requireSupabaseAuth` middleware in
 * `src/integrations/supabase/auth-middleware.ts` (which only wraps
 * `createServerFn`) does not apply to them. Each raw route was previously
 * re-implementing this same Bearer-token parsing + `getClaims()` check
 * independently (see the original `api/chat.ts`, `api/shopping-agent.ts`).
 * This is the single, tested implementation those routes should migrate to.
 *
 * Returns `null` on any auth failure — callers decide the response shape/
 * status via `withGateway`, keeping this function focused on verification.
 */
export async function authenticateRequest(request: Request): Promise<AuthenticatedUser | null> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;

  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  if (!token) return null;

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;

  return {
    userId: data.claims.sub as string,
    claims: data.claims as Record<string, unknown>,
    supabase,
  };
}

/**
 * Checks whether an authenticated user holds the admin role, via the same
 * security-definer `has_role` RPC used by `AuthContext` and the edge
 * functions' `requireAdmin()` helper — one source of truth for "is this
 * user an admin" across the whole system.
 */
export async function isRequestFromAdmin(user: AuthenticatedUser): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("has_role", {
    p_user: user.userId,
    p_role: "admin",
  });
  return !error && data === true;
}

/**
 * Module 3 (Global Authentication — RBAC foundation).
 *
 * `app_role` already has three values in the live database — "admin",
 * "moderator", "user" (confirmed via the generated Supabase types) — but
 * before this module, application code only ever checked for "admin".
 * "moderator" existed at the DB/enum level with no code path that used it.
 *
 * These helpers generalize role-checking beyond the admin-only boolean,
 * without touching `isRequestFromAdmin` above (kept for backward
 * compatibility with existing call sites).
 */
export type AppRole = "admin" | "moderator" | "user";

export async function getRequestRoles(user: AuthenticatedUser): Promise<AppRole[]> {
  const { data, error } = await supabaseAdmin.rpc("get_user_roles", { p_user: user.userId });
  if (error || !data) return [];
  return data as AppRole[];
}

export async function isRequestFromRole(user: AuthenticatedUser, role: AppRole): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("has_role", {
    p_user: user.userId,
    p_role: role,
  });
  return !error && data === true;
}

export async function isRequestFromAnyRole(
  user: AuthenticatedUser,
  roles: AppRole[],
): Promise<boolean> {
  const userRoles = await getRequestRoles(user);
  return roles.some((r) => userRoles.includes(r));
}
