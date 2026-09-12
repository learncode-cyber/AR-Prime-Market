// Public callback endpoint used by the Telegram webhook edge function to
// approve or reject a pending product. Gated by CRON_SECRET — never call
// from the browser.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sourcing-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) return new Response("CRON_SECRET not configured", { status: 500 });
        const got = request.headers.get("x-cron-secret") || "";
        if (got !== secret) return new Response("unauthorized", { status: 401 });

        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response("bad json", { status: 400 });
        }
        const id = String(body?.id || "");
        const action = String(body?.action || "");
        const decidedBy = body?.decided_by ? String(body.decided_by) : null;
        if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("bad id", { status: 400 });

        try {
          if (action === "approve") {
            const { processApprovePending } = await import("@/lib/approval-processor.server");
            const out = await processApprovePending(id, decidedBy);
            return Response.json({ ok: true, ...out });
          }
          if (action === "reject") {
            const { processRejectPending } = await import("@/lib/approval-processor.server");
            const out = await processRejectPending(id, decidedBy, body?.reason);
            return Response.json({ ok: true, ...out });
          }
          return new Response("unknown action", { status: 400 });
        } catch (e: unknown) {
          return Response.json(
            { ok: false, error: (e instanceof Error ? e.message : String(e)) || "failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
