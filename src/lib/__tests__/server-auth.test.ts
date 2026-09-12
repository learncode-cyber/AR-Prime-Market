import { describe, it, expect, vi } from "vitest";
import { requireRole, requireAdmin } from "@/lib/server-auth";

function fakeSupabase(roles: string[] | null, errored = false) {
  return {
    rpc: vi
      .fn()
      .mockResolvedValue(
        errored ? { data: null, error: { message: "boom" } } : { data: roles, error: null },
      ),
  };
}

describe("requireRole", () => {
  it("resolves when the user has one of the required roles", async () => {
    const supabase = fakeSupabase(["moderator"]);
    await expect(requireRole(supabase, "u1", ["admin", "moderator"])).resolves.toBeUndefined();
  });

  it("throws a 403 Response when the user has none of the required roles", async () => {
    const supabase = fakeSupabase(["user"]);
    await expect(requireRole(supabase, "u1", ["admin"])).rejects.toMatchObject({ status: 403 });
  });

  it("fails closed (throws) when the RPC errors", async () => {
    const supabase = fakeSupabase(null, true);
    await expect(requireRole(supabase, "u1", ["admin"])).rejects.toMatchObject({ status: 403 });
  });

  it("fails closed when the RPC returns a non-array payload", async () => {
    const supabase = { rpc: vi.fn().mockResolvedValue({ data: "nope", error: null }) };
    await expect(requireRole(supabase, "u1", ["admin"])).rejects.toMatchObject({ status: 403 });
  });

  it("calls get_user_roles with the given user id", async () => {
    const supabase = fakeSupabase(["admin"]);
    await requireRole(supabase, "u42", ["admin"]);
    expect(supabase.rpc).toHaveBeenCalledWith("get_user_roles", { p_user: "u42" });
  });

  it("the thrown Response body explains which roles were required", async () => {
    const supabase = fakeSupabase(["user"]);
    try {
      await requireRole(supabase, "u1", ["admin", "moderator"]);
      throw new Error("should have thrown");
    } catch (e) {
      const res = e as Response;
      const body = await res.json();
      expect(body.error).toMatch(/admin, moderator/);
    }
  });
});

describe("requireAdmin", () => {
  it("is a shorthand for requireRole(..., ['admin'])", async () => {
    const supabase = fakeSupabase(["admin"]);
    await expect(requireAdmin(supabase, "u1")).resolves.toBeUndefined();
  });

  it("rejects a non-admin", async () => {
    const supabase = fakeSupabase(["moderator"]);
    await expect(requireAdmin(supabase, "u1")).rejects.toMatchObject({ status: 403 });
  });
});
