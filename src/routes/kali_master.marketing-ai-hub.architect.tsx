import { createFileRoute } from "@tanstack/react-router";
import { AdminPending, AdminErrorComponent, AdminNotFound } from "@/lib/admin-route-boundaries";
import { ArchitectTab } from "@/lib/marketing-ai-hub-shared";

export const Route = createFileRoute("/kali_master/marketing-ai-hub/architect")({
  pendingComponent: () => <AdminPending />,
  errorComponent: AdminErrorComponent,
  notFoundComponent: AdminNotFound,
  component: ArchitectTab,
});
