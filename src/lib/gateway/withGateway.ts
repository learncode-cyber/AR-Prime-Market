import { generateRequestId, gatewayError } from "./response";
import { defaultRateLimiter, clientKeyFromRequest, type RateLimiter } from "./rateLimiter";
import {
  authenticateRequest,
  isRequestFromAdmin,
  isRequestFromAnyRole,
  type AuthenticatedUser,
  type AppRole,
} from "./userAuth";
import { verifyCronRequest } from "./cronAuth";
import { reportError } from "@/lib/monitoring";

export type AuthMode = "public" | "user" | "admin" | "cron";

export interface GatewayOptions {
  /** Route name used for rate-limit bucketing and logging — keep it stable. */
  routeName: string;
  /**
   * - "public": no auth check performed by the gateway.
   * - "user": requires a valid Supabase Bearer token; the authenticated
   *   user is passed to the handler as `ctx.user`.
   * - "admin": requires a valid Bearer token AND the admin role.
   * - "cron": requires a valid CRON_SECRET (env or integration_secrets).
   */
  auth: AuthMode;
  /**
   * Module 3 (Global Auth RBAC): restrict a "user" auth-mode route to one
   * or more specific roles beyond "admin" (e.g. `["admin", "moderator"]`).
   * Ignored for "admin"/"cron"/"public" modes — use `auth: "admin"` for
   * admin-only routes, this is for the newer non-admin roles.
   */
  requiredRoles?: AppRole[];
  /** Omit to disable rate limiting for this route (e.g. some cron routes
   *  are already effectively rate-limited by their own schedule). */
  rateLimit?: { limit: number; windowMs: number };
  rateLimiter?: RateLimiter; // injectable for tests
}

export interface GatewayContext {
  request: Request;
  requestId: string;
  user: AuthenticatedUser | null;
}

export type GatewayHandler = (ctx: GatewayContext) => Promise<Response>;

/**
 * Wraps a raw API route handler with the gateway's cross-cutting concerns:
 * auth verification, rate limiting, and a consistent JSON error shape on
 * failure. On success, the wrapped handler's own `Response` is returned
 * unchanged — the gateway does not rewrite successful responses, so
 * existing route response shapes are preserved during migration.
 *
 * Example (see the migrated `zero-trust-scan.ts` for the full pattern):
 *
 *   POST: withGateway({ routeName: "cron.zero-trust-scan", auth: "cron" },
 *     async (ctx) => {
 *       const summary = await runZeroTrustScan("cron");
 *       return Response.json({ ok: true, summary });
 *     })
 */
export function withGateway(
  options: GatewayOptions,
  handler: GatewayHandler,
): (args: { request: Request }) => Promise<Response> {
  return async ({ request }) => {
    const requestId = generateRequestId();
    const limiter = options.rateLimiter ?? defaultRateLimiter;

    if (options.rateLimit) {
      const key = clientKeyFromRequest(request, options.routeName);
      const result = limiter.check(key, options.rateLimit.limit, options.rateLimit.windowMs);
      if (!result.allowed) {
        return gatewayError(
          "RATE_LIMITED",
          "Too many requests. Please try again shortly.",
          429,
          requestId,
        );
      }
    }

    let user: AuthenticatedUser | null = null;

    if (options.auth === "cron") {
      const ok = await verifyCronRequest(request);
      if (!ok)
        return gatewayError("UNAUTHORIZED", "Invalid or missing cron credentials.", 401, requestId);
    } else if (options.auth === "user" || options.auth === "admin") {
      user = await authenticateRequest(request);
      if (!user)
        return gatewayError("UNAUTHORIZED", "A valid session is required.", 401, requestId);
      if (options.auth === "admin") {
        const admin = await isRequestFromAdmin(user);
        if (!admin) return gatewayError("FORBIDDEN", "Admin role required.", 403, requestId);
      } else if (options.requiredRoles && options.requiredRoles.length > 0) {
        const allowed = await isRequestFromAnyRole(user, options.requiredRoles);
        if (!allowed) {
          return gatewayError(
            "FORBIDDEN",
            `One of these roles is required: ${options.requiredRoles.join(", ")}.`,
            403,
            requestId,
          );
        }
      }
    }

    try {
      return await handler({ request, requestId, user });
    } catch (err) {
      // Never leak internal error details (stack traces, DB error text) to
      // the client — log server-side only, return a generic message.
      reportError(err, { source: `gateway:${options.routeName}`, requestId });
      return gatewayError(
        "INTERNAL_ERROR",
        "Something went wrong. Please try again.",
        500,
        requestId,
      );
    }
  };
}
