import { describe, it, expect } from "vitest";
import { gatewayError, gatewayJson, generateRequestId } from "@/lib/gateway/response";

describe("gateway response helpers", () => {
  it("generateRequestId returns a unique string each call", () => {
    const a = generateRequestId();
    const b = generateRequestId();
    expect(a).not.toBe(b);
    expect(typeof a).toBe("string");
    expect(a.length).toBeGreaterThan(10);
  });

  it("gatewayError produces the standardized error shape and status", async () => {
    const res = gatewayError("UNAUTHORIZED", "nope", 401, "req-1");
    expect(res.status).toBe(401);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("X-Request-Id")).toBe("req-1");
    const body = await res.json();
    expect(body).toEqual({
      error: { code: "UNAUTHORIZED", message: "nope", requestId: "req-1" },
    });
  });

  it("gatewayJson wraps data with a 200 default status", async () => {
    const res = gatewayJson({ ok: true });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it("gatewayJson accepts a custom status and requestId header", async () => {
    const res = gatewayJson({ created: true }, 201, "req-2");
    expect(res.status).toBe(201);
    expect(res.headers.get("X-Request-Id")).toBe("req-2");
  });
});
