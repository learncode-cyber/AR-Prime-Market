/**
 * Standardized response helpers for gateway-wrapped API routes.
 *
 * Goal: every route behind the gateway returns errors in the same JSON
 * shape (`{ error: { code, message, requestId } }`), instead of the mix of
 * plain-text `new Response("Unauthorized", ...)` and ad hoc JSON bodies
 * that exist across the current `src/routes/api/*` handlers. This makes
 * client-side error handling and observability consistent.
 */

export function generateRequestId(): string {
  // Not cryptographically sensitive — just needs to be unique enough to
  // correlate a request across logs. crypto.randomUUID() is available in
  // both the Node and Deno/edge runtimes this app targets.
  return crypto.randomUUID();
}

export interface GatewayErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

export function gatewayError(
  code: string,
  message: string,
  status: number,
  requestId: string,
): Response {
  const body: GatewayErrorBody = { error: { code, message, requestId } };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
  });
}

export function gatewayJson<T>(data: T, status = 200, requestId?: string): Response {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (requestId) headers["X-Request-Id"] = requestId;
  return new Response(JSON.stringify(data), { status, headers });
}
