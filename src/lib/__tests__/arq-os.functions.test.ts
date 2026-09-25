import { describe, it, expect, vi } from "vitest";
import { requireAnyRole } from "@/lib/arq-os.functions";

function fakeSupabase(roles: string[] | null, errored = false) {
  return {
    rpc: vi
      .fn()
      .mockResolvedValue(
        errored ? { data: null, error: { message: "boom" } } : { data: roles, error: null },
      ),
  };
}

describe("requireAnyRole (ARQ Master OS core)", () => {
  it("resolves without throwing when the user has one of the required roles", async () => {
    const supabase = fakeSupabase(["moderator"]);
    await expect(requireAnyRole(supabase, "u1", ["admin", "moderator"])).resolves.toBeUndefined();
  });

  it("throws a Forbidden error when the user has none of the required roles", async () => {
    const supabase = fakeSupabase(["user"]);
    await expect(requireAnyRole(supabase, "u1", ["admin", "moderator"])).rejects.toThrow(
      /Forbidden: one of these roles is required: admin, moderator/,
    );
  });

  it("throws when the RPC errors (fail closed, not open)", async () => {
    const supabase = fakeSupabase(null, true);
    await expect(requireAnyRole(supabase, "u1", ["admin"])).rejects.toThrow(/Forbidden/);
  });

  it("throws when the RPC returns a non-array payload", async () => {
    const supabase = { rpc: vi.fn().mockResolvedValue({ data: "not-an-array", error: null }) };
    await expect(requireAnyRole(supabase, "u1", ["admin"])).rejects.toThrow(/Forbidden/);
  });

  it("calls get_user_roles with the correct user id", async () => {
    const supabase = fakeSupabase(["admin"]);
    await requireAnyRole(supabase, "u42", ["admin"]);
    expect(supabase.rpc).toHaveBeenCalledWith("get_user_roles", { p_user: "u42" });
  });
});
