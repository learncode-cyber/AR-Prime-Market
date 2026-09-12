import { createFileRoute } from "@tanstack/react-router";
import { AdminPending, AdminErrorComponent, AdminNotFound } from "@/lib/admin-route-boundaries";
import { PixelsTab } from "@/lib/marketing-ai-hub-shared";

export const Route = createFileRoute("/kali_master/marketing-ai-hub/pixels")({
  pendingComponent: () => <AdminPending />,
  errorComponent: AdminErrorComponent,
  notFoundComponent: AdminNotFound,
  component: PixelsTab,
});
