import { createFileRoute } from "@tanstack/react-router";
import { AdminPending, AdminErrorComponent, AdminNotFound } from "@/lib/admin-route-boundaries";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Webhook, Copy, Plug } from "lucide-react";
import { getWebhookUrl } from "@/lib/cj-settings-shared";

export const Route = createFileRoute("/kali_master/cj-settings/webhook")({
  pendingComponent: () => <AdminPending />,
  errorComponent: AdminErrorComponent,
  notFoundComponent: AdminNotFound,
  component: CjWebhookSection,
});

function CjWebhookSection() {
  const webhookUrl = useMemo(() => getWebhookUrl(), []);

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  }

  async function handleTestWebhook() {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "PING", data: { ts: Date.now() } }),
      });
      if (res.ok) toast.success("Webhook reachable (200)");
      else toast.error(`Webhook returned ${res.status}`);
    } catch (e: unknown) {
      toast.error(`Webhook test failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="w-4 h-4" /> Webhook Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 items-center">
          <Input readOnly value={webhookUrl} className="font-mono text-xs" />
          <Button size="sm" variant="outline" onClick={() => copy(webhookUrl)}>
            <Copy className="w-3 h-3" />
          </Button>
          <Button size="sm" onClick={handleTestWebhook}>
            <Plug className="w-3 h-3 mr-1" /> Test
          </Button>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>1. Go to your CJ Dashboard → API → Webhook settings.</p>
          <p>2. Paste the URL above as your callback endpoint.</p>
          <p>
            3. Subscribe to topics: <code className="px-1 py-0.5 rounded bg-secondary">STOCK</code>,{" "}
            <code className="px-1 py-0.5 rounded bg-secondary">PRODUCT</code>,{" "}
            <code className="px-1 py-0.5 rounded bg-secondary">VARIANT</code>,{" "}
            <code className="px-1 py-0.5 rounded bg-secondary">ORDER</code>,{" "}
            <code className="px-1 py-0.5 rounded bg-secondary">LOGISTIC</code>.
          </p>
          <p>4. Imported product stock updates in real-time via Supabase realtime.</p>
        </div>
      </CardContent>
    </Card>
  );
}
