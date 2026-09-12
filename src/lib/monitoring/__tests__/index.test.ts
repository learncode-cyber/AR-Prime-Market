import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  consoleReporter,
  createWebhookReporter,
  reportError,
  _resetReportersForTests,
} from "@/lib/monitoring";

describe("consoleReporter", () => {
  it("logs a structured JSON line with source, message, and timestamp", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleReporter.reportError(new Error("boom"), { source: "test:unit" });
    expect(spy).toHaveBeenCalled();
    const logged = JSON.parse(spy.mock.calls[0][0] as string);
    expect(logged.source).toBe("test:unit");
    expect(logged.message).toBe("boom");
    expect(typeof logged.timestamp).toBe("string");
    spy.mockRestore();
  });

  it("handles non-Error thrown values without crashing", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => consoleReporter.reportError("just a string", { source: "x" })).not.toThrow();
    const logged = JSON.parse(spy.mock.calls[0][0] as string);
    expect(logged.message).toBe("just a string");
    spy.mockRestore();
  });

  it("includes requestId when provided", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleReporter.reportError(new Error("x"), { source: "s", requestId: "req-123" });
    const logged = JSON.parse(spy.mock.calls[0][0] as string);
    expect(logged.requestId).toBe("req-123");
    spy.mockRestore();
  });
});

describe("createWebhookReporter", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("POSTs a text payload to the configured URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    const reporter = createWebhookReporter("https://example.test/hook");
    await reporter.reportError(new Error("db down"), { source: "cron:sync", requestId: "r1" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/hook",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.text).toContain("cron:sync");
    expect(body.text).toContain("db down");
    expect(body.text).toContain("r1");
  });

  it("never throws even if the webhook call fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    const reporter = createWebhookReporter("https://example.test/hook");
    await expect(reporter.reportError(new Error("x"), { source: "s" })).resolves.toBeUndefined();
  });
});

describe("reportError (aggregate)", () => {
  beforeEach(() => {
    _resetReportersForTests();
    delete process.env.MONITORING_WEBHOOK_URL;
  });

  it("always reports to console even with no webhook configured", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    reportError(new Error("test"), { source: "s" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("also reports to the webhook when MONITORING_WEBHOOK_URL is set", async () => {
    process.env.MONITORING_WEBHOOK_URL = "https://example.test/hook";
    _resetReportersForTests();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    reportError(new Error("test"), { source: "s" });
    // webhook call is fire-and-forget; flush microtasks
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchMock).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("never throws synchronously, regardless of configuration", () => {
    expect(() => reportError(new Error("x"), { source: "s" })).not.toThrow();
  });
});
