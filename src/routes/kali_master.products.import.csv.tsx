import { createFileRoute } from "@tanstack/react-router";
import { AdminPending, AdminErrorComponent, AdminNotFound } from "@/lib/admin-route-boundaries";
import { CsvOrUrlImport } from "@/lib/products-import-shared";

export const Route = createFileRoute("/kali_master/products/import/csv")({
  pendingComponent: () => <AdminPending />,
  errorComponent: AdminErrorComponent,
  notFoundComponent: AdminNotFound,
  component: CsvOrUrlImport,
});
