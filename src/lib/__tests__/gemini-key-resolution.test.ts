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

import {
  resolveGeminiKey,
  isGeminiConfigured,
  _resetGeminiKeyCacheForTests,
} from "@/lib/gemini.server";

describe("resolveGeminiKey (admin-panel-configurable, Module 15)", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    _resetGeminiKeyCacheForTests();
    maybeSingleMock.mockReset();
    delete process.env.GEMINI_API_KEY;
    delete process.env.CHAT_GEMINI_KEY;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("uses the admin-panel key from api_credentials when set and active", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { credentials: { api_key: "panel-key-123" }, is_active: true },
    });
    const key = await resolveGeminiKey();
    expect(key).toBe("panel-key-123");
  });

  it("ignores the admin-panel key when is_active is explicitly false", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { credentials: { api_key: "panel-key-123" }, is_active: false },
    });
    process.env.GEMINI_API_KEY = "env-fallback-key";
    const key = await resolveGeminiKey();
    expect(key).toBe("env-fallback-key");
  });

  it("a surface-specific env var takes priority over the admin-panel key", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { credentials: { api_key: "panel-key-123" }, is_active: true },
    });
    process.env.CHAT_GEMINI_KEY = "surface-override-key";
    const key = await resolveGeminiKey("chat");
    expect(key).toBe("surface-override-key");
  });

  it("falls back to the master GEMINI_API_KEY when no admin-panel key exists", async () => {
    maybeSingleMock.mockResolvedValue({ data: null });
    process.env.GEMINI_API_KEY = "master-env-key";
    const key = await resolveGeminiKey();
    expect(key).toBe("master-env-key");
  });

  it("throws a clear, actionable error when nothing is configured anywhere", async () => {
    maybeSingleMock.mockResolvedValue({ data: null });
    await expect(resolveGeminiKey()).rejects.toThrow(/Admin Panel -> API Keys/);
  });

  it("does not throw and returns null gracefully when the DB lookup itself fails", async () => {
    maybeSingleMock.mockRejectedValue(new Error("db unreachable"));
    process.env.GEMINI_API_KEY = "master-env-key";
    const key = await resolveGeminiKey();
    expect(key).toBe("master-env-key");
  });

  it("caches the DB lookup so repeated calls within the TTL don't hit the DB again", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { credentials: { api_key: "panel-key-123" }, is_active: true },
    });
    await resolveGeminiKey();
    await resolveGeminiKey();
    await resolveGeminiKey();
    expect(maybeSingleMock).toHaveBeenCalledTimes(1);
  });

  it("isGeminiConfigured returns true when a key resolves successfully", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { credentials: { api_key: "panel-key-123" }, is_active: true },
    });
    expect(await isGeminiConfigured()).toBe(true);
  });

  it("isGeminiConfigured returns false (not throw) when nothing is configured", async () => {
    maybeSingleMock.mockResolvedValue({ data: null });
    expect(await isGeminiConfigured()).toBe(false);
  });
});
