import { createFileRoute } from "@tanstack/react-router";
import { AdminPending, AdminErrorComponent, AdminNotFound } from "@/lib/admin-route-boundaries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Globe, Copy } from "lucide-react";

export const Route = createFileRoute("/kali_master/seo-audit/webhook")({
  pendingComponent: () => <AdminPending />,
  errorComponent: AdminErrorComponent,
  notFoundComponent: AdminNotFound,
  component: WebhookTab,
});

function WebhookTab() {
  const webhookUrl = `https://arprimemarket.shop/api/public/seo/post-deploy`;

  return (
    <Card className="p-6 space-y-3">
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">Post-deploy webhook</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        POST to this URL with header{" "}
        <code className="text-xs bg-muted px-1 rounded">x-cron-secret: $CRON_SECRET</code> after
        each deploy. Returns 204 if auto-rescan is disabled.
      </p>
      <div className="flex gap-2">
        <Input readOnly value={webhookUrl} />
        <Button
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(webhookUrl);
            toast.success("Copied");
          }}
        >
          <Copy className="w-4 h-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Cron endpoint: <code>/api/public/seo/cron</code> (same auth).
      </p>
    </Card>
  );
}
