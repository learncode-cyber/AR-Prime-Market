import { createFileRoute } from "@tanstack/react-router";
import { AdminPending, AdminErrorComponent, AdminNotFound } from "@/lib/admin-route-boundaries";
import { SeoTab } from "@/lib/marketing-ai-hub-shared";

export const Route = createFileRoute("/kali_master/marketing-ai-hub/seo")({
  pendingComponent: () => <AdminPending />,
  errorComponent: AdminErrorComponent,
  notFoundComponent: AdminNotFound,
  component: SeoTab,
});
