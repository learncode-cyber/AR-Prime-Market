import { createFileRoute } from "@tanstack/react-router";
import { AdminPending, AdminErrorComponent, AdminNotFound } from "@/lib/admin-route-boundaries";
import { SingleImport } from "@/lib/products-import-shared";

export const Route = createFileRoute("/kali_master/products/import/spocket")({
  pendingComponent: () => <AdminPending />,
  errorComponent: AdminErrorComponent,
  notFoundComponent: AdminNotFound,
  component: () => (
    <SingleImport
      provider="spocket"
      hint="Paste Spocket product ID — requires SPOCKET_API_KEY secret"
    />
  ),
});
