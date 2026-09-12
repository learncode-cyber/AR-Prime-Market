import { describe, it, expect } from "vitest";
import { InMemoryRateLimiter, clientKeyFromRequest } from "@/lib/gateway/rateLimiter";

describe("InMemoryRateLimiter", () => {
  it("allows requests up to the limit within the window", () => {
    const rl = new InMemoryRateLimiter();
    for (let i = 0; i < 5; i++) {
      const r = rl.check("k1", 5, 60_000);
      expect(r.allowed).toBe(true);
    }
  });

  it("blocks the request that exceeds the limit", () => {
    const rl = new InMemoryRateLimiter();
    for (let i = 0; i < 3; i++) rl.check("k2", 3, 60_000);
    const blocked = rl.check("k2", 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets the count after the window elapses", async () => {
    const rl = new InMemoryRateLimiter();
    for (let i = 0; i < 2; i++) rl.check("k3", 2, 20);
    expect(rl.check("k3", 2, 20).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 30));
    expect(rl.check("k3", 2, 20).allowed).toBe(true);
  });

  it("tracks distinct keys independently", () => {
    const rl = new InMemoryRateLimiter();
    rl.check("a", 1, 60_000);
    const bResult = rl.check("b", 1, 60_000);
    expect(bResult.allowed).toBe(true);
  });

  it("evicts the oldest bucket when maxBuckets is exceeded", () => {
    const rl = new InMemoryRateLimiter(2);
    rl.check("k1", 10, 60_000);
    rl.check("k2", 10, 60_000);
    rl.check("k3", 10, 60_000); // should evict k1
    expect(rl.size()).toBeLessThanOrEqual(2);
  });
});

describe("clientKeyFromRequest", () => {
  it("uses cf-connecting-ip when present", () => {
    const req = new Request("https://x.test/api", {
      headers: { "cf-connecting-ip": "1.2.3.4" },
    });
    expect(clientKeyFromRequest(req, "test-route")).toBe("test-route:1.2.3.4");
  });

  it("falls back to x-forwarded-for", () => {
    const req = new Request("https://x.test/api", {
      headers: { "x-forwarded-for": "5.6.7.8, 9.9.9.9" },
    });
    expect(clientKeyFromRequest(req, "test-route")).toBe("test-route:5.6.7.8");
  });

  it("falls back to unknown when no IP header is present", () => {
    const req = new Request("https://x.test/api");
    expect(clientKeyFromRequest(req, "test-route")).toBe("test-route:unknown");
  });
});
