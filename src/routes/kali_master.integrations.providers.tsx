import { createFileRoute } from "@tanstack/react-router";
import { AdminPending, AdminErrorComponent, AdminNotFound } from "@/lib/admin-route-boundaries";
import { Badge } from "@/components/ui/badge";
import {
  ProviderCard,
  SEO_PROVIDERS_INTEG,
  ZeroKnowledgeNote,
  useIntegrationSettings,
  type ProviderKey,
} from "@/lib/integrations-shared";

export const Route = createFileRoute("/kali_master/integrations/providers")({
  pendingComponent: () => <AdminPending />,
  errorComponent: AdminErrorComponent,
  notFoundComponent: AdminNotFound,
  component: ProvidersPage,
});

function ProvidersPage() {
  const { data: settings, isLoading } = useIntegrationSettings();
  const activeProvider = settings?.find(
    (s) => s.is_active && ["semrush", "ahrefs", "dataforseo", "serpapi"].includes(s.provider),
  )?.provider as ProviderKey | undefined;

  return (
    <div className="space-y-6">
      <ZeroKnowledgeNote />
      {activeProvider && (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <span>Active keyword provider:</span>
          <Badge variant="secondary" className="uppercase font-semibold">
            {activeProvider}
          </Badge>
        </div>
      )}
      <div className="grid gap-4">
        {SEO_PROVIDERS_INTEG.map((p) => {
          const row = settings?.find((s) => s.provider === p.key);
          return (
            <ProviderCard
              key={p.key}
              providerKey={p.key}
              label={p.label}
              description={p.description}
              placeholder={p.placeholder}
              helpUrl={p.helpUrl}
              isActive={!!row?.is_active}
              hasKey={!!row}
              updatedAt={row?.updated_at}
              loading={isLoading}
            />
          );
        })}
      </div>
    </div>
  );
}
