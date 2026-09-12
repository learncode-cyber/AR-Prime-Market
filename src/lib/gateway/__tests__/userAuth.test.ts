import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

import {
  isRequestFromAdmin,
  getRequestRoles,
  isRequestFromRole,
  isRequestFromAnyRole,
  type AuthenticatedUser,
} from "@/lib/gateway/userAuth";

const fakeUser: AuthenticatedUser = { userId: "u1", claims: {}, supabase: {} as never };

describe("RBAC helpers (Module 3)", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("isRequestFromAdmin calls has_role with role='admin'", async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });
    const result = await isRequestFromAdmin(fakeUser);
    expect(result).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith("has_role", { p_user: "u1", p_role: "admin" });
  });

  it("isRequestFromAdmin returns false on RPC error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await isRequestFromAdmin(fakeUser)).toBe(false);
  });

  it("getRequestRoles returns the roles array from get_user_roles", async () => {
    rpcMock.mockResolvedValue({ data: ["admin", "moderator"], error: null });
    const roles = await getRequestRoles(fakeUser);
    expect(roles).toEqual(["admin", "moderator"]);
    expect(rpcMock).toHaveBeenCalledWith("get_user_roles", { p_user: "u1" });
  });

  it("getRequestRoles returns an empty array on error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await getRequestRoles(fakeUser)).toEqual([]);
  });

  it("isRequestFromRole checks a specific non-admin role via has_role", async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });
    const result = await isRequestFromRole(fakeUser, "moderator");
    expect(result).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith("has_role", { p_user: "u1", p_role: "moderator" });
  });

  it("isRequestFromAnyRole returns true if the user holds ANY of the listed roles", async () => {
    rpcMock.mockResolvedValue({ data: ["moderator"], error: null });
    const result = await isRequestFromAnyRole(fakeUser, ["admin", "moderator"]);
    expect(result).toBe(true);
  });

  it("isRequestFromAnyRole returns false if the user holds none of the listed roles", async () => {
    rpcMock.mockResolvedValue({ data: ["user"], error: null });
    const result = await isRequestFromAnyRole(fakeUser, ["admin", "moderator"]);
    expect(result).toBe(false);
  });
});
