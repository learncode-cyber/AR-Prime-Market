import { createFileRoute } from "@tanstack/react-router";
import { AdminPending, AdminErrorComponent, AdminNotFound } from "@/lib/admin-route-boundaries";
import { ImageIcon } from "lucide-react";
import { ProviderCard, useIntegrationSettings } from "@/lib/integrations-shared";

export const Route = createFileRoute("/kali_master/integrations/imgbb")({
  pendingComponent: () => <AdminPending />,
  errorComponent: AdminErrorComponent,
  notFoundComponent: AdminNotFound,
  component: ImgBBPage,
});

function ImgBBPage() {
  const { data: settings, isLoading } = useIntegrationSettings();
  const row = settings?.find((s) => s.provider === "imgbb");
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-primary" />
          Image Hosting
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          When an image host is active, all in-app uploads (avatars, return photos, blog & product
          images) are pushed to that third-party host and only the direct URL is saved in the
          database. If inactive, uploads fall back to Supabase Storage.
        </p>
      </div>
      <ProviderCard
        providerKey="imgbb"
        label="ImgBB"
        description="Free image hosting with direct URLs. Get a key at imgbb.com (My account → API)."
        placeholder="Your ImgBB API key (32+ chars)"
        helpUrl="https://api.imgbb.com/"
        isActive={!!row?.is_active}
        hasKey={!!row}
        updatedAt={row?.updated_at}
        loading={isLoading}
      />
    </div>
  );
}
