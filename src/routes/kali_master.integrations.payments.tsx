import { createFileRoute } from "@tanstack/react-router";
import { AdminPending, AdminErrorComponent, AdminNotFound } from "@/lib/admin-route-boundaries";
import { BkashCard, BinanceCard, useIntegrationSettings } from "@/lib/integrations-shared";

export const Route = createFileRoute("/kali_master/integrations/payments")({
  pendingComponent: () => <AdminPending />,
  errorComponent: AdminErrorComponent,
  notFoundComponent: AdminNotFound,
  component: PaymentsPage,
});

function PaymentsPage() {
  const { data: settings, isLoading } = useIntegrationSettings();
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Payment Gateways</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Configure bKash Sandbox and Binance Pay credentials. These are read by the{" "}
          <code className="bg-secondary px-1 py-0.5 rounded text-xs">bkash-pay</code> and{" "}
          <code className="bg-secondary px-1 py-0.5 rounded text-xs">binance-pay</code> edge
          functions at checkout.
        </p>
      </div>
      <div className="grid gap-4">
        <BkashCard row={settings?.find((s) => s.provider === "bkash")} loading={isLoading} />
        <BinanceCard row={settings?.find((s) => s.provider === "binance")} loading={isLoading} />
      </div>
    </div>
  );
}
