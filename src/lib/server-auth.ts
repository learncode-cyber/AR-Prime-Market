/**
 * Shared server-side role enforcement for `createServerFn` handlers.
 *
 * Background: `requireSupabaseAuth` (the auto-generated middleware every
 * `.functions.ts` file uses) only verifies the caller has SOME valid
 * logged-in session — it does not check role. Before this file existed,
 * only `arq-os.functions.ts` (Module 6) had its own local role-check
 * helper; every other admin-facing server function relied on
 * `requireSupabaseAuth` alone. For the ~19 of those that additionally use
 * `supabaseAdmin` (the service-role client, which bypasses RLS entirely),
 * that meant ANY authenticated user — including a customer who just
 * signed up — could call them directly via HTTP and read/write
 * admin-only data. The client-side `isAdmin` gate in
 * `src/routes/kali_master.tsx` only hides the UI; it does not protect
 * these endpoints, which are independently reachable.
 *
 * This is the one shared implementation every admin `.functions.ts` file
 * should call at the top of each handler that touches admin-only data.
 */
export async function requireRole(
  supabase: unknown,
  userId: string,
  roles: string[],
): Promise<void> {
  const client = supabase as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  };
  const { data, error } = await client.rpc("get_user_roles", { p_user: userId });
  const userRoles = !error && Array.isArray(data) ? (data as string[]) : [];
  const allowed = roles.some((r) => userRoles.includes(r));
  if (!allowed) {
    throw new Response(
      JSON.stringify({
        error: `Forbidden: one of these roles is required: ${roles.join(", ")}`,
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }
}

/** Convenience wrapper for the common "admin only" case. */
export async function requireAdmin(supabase: unknown, userId: string): Promise<void> {
  return requireRole(supabase, userId, ["admin"]);
}
