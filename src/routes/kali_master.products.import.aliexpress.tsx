import { createFileRoute } from "@tanstack/react-router";
import { AdminPending, AdminErrorComponent, AdminNotFound } from "@/lib/admin-route-boundaries";
import { SingleImport } from "@/lib/products-import-shared";

export const Route = createFileRoute("/kali_master/products/import/aliexpress")({
  pendingComponent: () => <AdminPending />,
  errorComponent: AdminErrorComponent,
  notFoundComponent: AdminNotFound,
  component: () => (
    <SingleImport provider="aliexpress" hint="Paste AliExpress item ID or full URL" />
  ),
});
