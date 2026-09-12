import { describe, it, expect, vi, beforeEach } from "vitest";

const authenticateRequestMock = vi.fn();
const isRequestFromAdminMock = vi.fn();
const isRequestFromAnyRoleMock = vi.fn();
const verifyCronRequestMock = vi.fn();

vi.mock("@/lib/gateway/userAuth", () => ({
  authenticateRequest: (...args: unknown[]) => authenticateRequestMock(...args),
  isRequestFromAdmin: (...args: unknown[]) => isRequestFromAdminMock(...args),
  isRequestFromAnyRole: (...args: unknown[]) => isRequestFromAnyRoleMock(...args),
}));

vi.mock("@/lib/gateway/cronAuth", () => ({
  verifyCronRequest: (...args: unknown[]) => verifyCronRequestMock(...args),
}));

import { withGateway } from "@/lib/gateway/withGateway";
import { InMemoryRateLimiter } from "@/lib/gateway/rateLimiter";

const req = () => new Request("https://x.test/api/thing", { method: "POST" });

describe("withGateway", () => {
  beforeEach(() => {
    authenticateRequestMock.mockReset();
    isRequestFromAdminMock.mockReset();
    isRequestFromAnyRoleMock.mockReset();
    verifyCronRequestMock.mockReset();
  });

  it("public routes never call any auth check", async () => {
    const handler = withGateway({ routeName: "t.public", auth: "public" }, async () =>
      Response.json({ ok: true }),
    );
    const res = await handler({ request: req() });
    expect(res.status).toBe(200);
    expect(authenticateRequestMock).not.toHaveBeenCalled();
    expect(verifyCronRequestMock).not.toHaveBeenCalled();
  });

  it("user routes reject when authenticateRequest returns null", async () => {
    authenticateRequestMock.mockResolvedValue(null);
    const handler = withGateway({ routeName: "t.user", auth: "user" }, async () =>
      Response.json({ ok: true }),
    );
    const res = await handler({ request: req() });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("user routes pass the authenticated user into the handler context", async () => {
    const fakeUser = { userId: "u1", claims: {}, supabase: {} };
    authenticateRequestMock.mockResolvedValue(fakeUser);
    let received: unknown = null;
    const handler = withGateway({ routeName: "t.user2", auth: "user" }, async (ctx) => {
      received = ctx.user;
      return Response.json({ ok: true });
    });
    await handler({ request: req() });
    expect(received).toBe(fakeUser);
  });

  it("admin routes reject a valid non-admin user with 403", async () => {
    authenticateRequestMock.mockResolvedValue({ userId: "u1", claims: {}, supabase: {} });
    isRequestFromAdminMock.mockResolvedValue(false);
    const handler = withGateway({ routeName: "t.admin", auth: "admin" }, async () =>
      Response.json({ ok: true }),
    );
    const res = await handler({ request: req() });
    expect(res.status).toBe(403);
  });

  it("admin routes allow a verified admin through", async () => {
    authenticateRequestMock.mockResolvedValue({ userId: "u1", claims: {}, supabase: {} });
    isRequestFromAdminMock.mockResolvedValue(true);
    const handler = withGateway({ routeName: "t.admin2", auth: "admin" }, async () =>
      Response.json({ ok: true }),
    );
    const res = await handler({ request: req() });
    expect(res.status).toBe(200);
  });

  it("cron routes reject when verifyCronRequest is false", async () => {
    verifyCronRequestMock.mockResolvedValue(false);
    const handler = withGateway({ routeName: "t.cron", auth: "cron" }, async () =>
      Response.json({ ok: true }),
    );
    const res = await handler({ request: req() });
    expect(res.status).toBe(401);
  });

  it("cron routes allow through when verifyCronRequest is true", async () => {
    verifyCronRequestMock.mockResolvedValue(true);
    const handler = withGateway({ routeName: "t.cron2", auth: "cron" }, async () =>
      Response.json({ ok: true }),
    );
    const res = await handler({ request: req() });
    expect(res.status).toBe(200);
  });

  it("enforces the rate limit before running the handler", async () => {
    const limiter = new InMemoryRateLimiter();
    const handlerFn = vi.fn(async () => Response.json({ ok: true }));
    const handler = withGateway(
      {
        routeName: "t.rl",
        auth: "public",
        rateLimit: { limit: 1, windowMs: 60_000 },
        rateLimiter: limiter,
      },
      handlerFn,
    );
    const res1 = await handler({ request: req() });
    const res2 = await handler({ request: req() });
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(429);
    expect(handlerFn).toHaveBeenCalledTimes(1);
  });

  it("converts a thrown error into a generic 500 without leaking details", async () => {
    const handler = withGateway({ routeName: "t.err", auth: "public" }, async () => {
      throw new Error("some internal db connection string leaked here");
    });
    const res = await handler({ request: req() });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toContain("connection string");
  });

  it("every error response includes a requestId for correlation", async () => {
    authenticateRequestMock.mockResolvedValue(null);
    const handler = withGateway({ routeName: "t.reqid", auth: "user" }, async () =>
      Response.json({ ok: true }),
    );
    const res = await handler({ request: req() });
    const body = await res.json();
    expect(typeof body.error.requestId).toBe("string");
    expect(res.headers.get("X-Request-Id")).toBe(body.error.requestId);
  });

  it("user routes with requiredRoles reject a user lacking any of them", async () => {
    authenticateRequestMock.mockResolvedValue({ userId: "u1", claims: {}, supabase: {} });
    isRequestFromAnyRoleMock.mockResolvedValue(false);
    const handler = withGateway(
      { routeName: "t.roles1", auth: "user", requiredRoles: ["moderator"] },
      async () => Response.json({ ok: true }),
    );
    const res = await handler({ request: req() });
    expect(res.status).toBe(403);
    expect(isRequestFromAnyRoleMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1" }),
      ["moderator"],
    );
  });

  it("user routes with requiredRoles allow a user holding one of them", async () => {
    authenticateRequestMock.mockResolvedValue({ userId: "u1", claims: {}, supabase: {} });
    isRequestFromAnyRoleMock.mockResolvedValue(true);
    const handler = withGateway(
      { routeName: "t.roles2", auth: "user", requiredRoles: ["admin", "moderator"] },
      async () => Response.json({ ok: true }),
    );
    const res = await handler({ request: req() });
    expect(res.status).toBe(200);
  });

  it("user routes without requiredRoles never call isRequestFromAnyRole", async () => {
    authenticateRequestMock.mockResolvedValue({ userId: "u1", claims: {}, supabase: {} });
    const handler = withGateway({ routeName: "t.roles3", auth: "user" }, async () =>
      Response.json({ ok: true }),
    );
    const res = await handler({ request: req() });
    expect(res.status).toBe(200);
    expect(isRequestFromAnyRoleMock).not.toHaveBeenCalled();
  });
});
