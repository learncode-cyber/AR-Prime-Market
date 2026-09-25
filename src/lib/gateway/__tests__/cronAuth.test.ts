import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const maybeSingleMock = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: maybeSingleMock,
        }),
      }),
    }),
  },
}));

import { verifyCronRequest } from "@/lib/gateway/cronAuth";

describe("verifyCronRequest", () => {
  const originalEnv = process.env.CRON_SECRET;

  beforeEach(() => {
    maybeSingleMock.mockReset();
    maybeSingleMock.mockResolvedValue({ data: null });
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalEnv;
  });

  it("accepts a request whose x-cron-secret matches the env secret", async () => {
    process.env.CRON_SECRET = "s3cr3t";
    const req = new Request("https://x.test/api", { headers: { "x-cron-secret": "s3cr3t" } });
    expect(await verifyCronRequest(req)).toBe(true);
  });

  it("accepts a request whose Authorization Bearer matches the env secret", async () => {
    process.env.CRON_SECRET = "s3cr3t";
    const req = new Request("https://x.test/api", { headers: { authorization: "Bearer s3cr3t" } });
    expect(await verifyCronRequest(req)).toBe(true);
  });

  it("rejects a request with no secret provided", async () => {
    process.env.CRON_SECRET = "s3cr3t";
    const req = new Request("https://x.test/api");
    expect(await verifyCronRequest(req)).toBe(false);
  });

  it("rejects a request with a wrong secret", async () => {
    process.env.CRON_SECRET = "s3cr3t";
    const req = new Request("https://x.test/api", { headers: { "x-cron-secret": "wrong" } });
    expect(await verifyCronRequest(req)).toBe(false);
  });

  it("rejects when neither env nor db secret is configured, even if a value is provided", async () => {
    delete process.env.CRON_SECRET;
    maybeSingleMock.mockResolvedValue({ data: null });
    const req = new Request("https://x.test/api", { headers: { "x-cron-secret": "anything" } });
    expect(await verifyCronRequest(req)).toBe(false);
  });

  it("falls back to the db-stored secret when env secret is unset", async () => {
    delete process.env.CRON_SECRET;
    maybeSingleMock.mockResolvedValue({ data: { api_key: "db-secret" } });
    const req = new Request("https://x.test/api", { headers: { "x-cron-secret": "db-secret" } });
    expect(await verifyCronRequest(req)).toBe(true);
  });

  it("does not throw when the integration_secrets lookup fails", async () => {
    process.env.CRON_SECRET = "s3cr3t";
    maybeSingleMock.mockRejectedValue(new Error("db down"));
    const req = new Request("https://x.test/api", { headers: { "x-cron-secret": "s3cr3t" } });
    expect(await verifyCronRequest(req)).toBe(true);
  });
});
