import { createFileRoute, Link, Outlet, useMatches } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, ChevronRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { BUILTIN_PROVIDERS, mergeProviders, type StoredCredRow } from "@/lib/integrations";

export const Route = createFileRoute("/kali_master/api-keys")({
  component: ApiKeysLayout,
});

function ApiKeysLayout() {
  // When a child route is matched (detail or new), render only the child.
  // Otherwise render the index list.
  const matches = useMatches();
  const isChild = matches.some(
    (m) =>
      m.routeId === "/kali_master/api-keys/$provider" || m.routeId === "/kali_master/api-keys/new",
  );
  if (isChild) return <Outlet />;
  return <ApiKeysIndex />;
}

function ApiKeysIndex() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StoredCredRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("api_credentials").select("*");
    if (error) {
      toast.error("Failed to load credentials");
      setRows([]);
    } else {
      setRows((data || []) as StoredCredRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const providers = mergeProviders(rows);
  const rowByKey = new Map(rows.map((r) => [r.provider, r] as const));

  function formatUpdated(iso?: string | null) {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return null;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">API Keys &amp; Integrations</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Each integration has its own page. Click any card to view or edit its credentials. You
            can also add your own custom integration.
          </p>
        </div>
        <Link to="/kali_master/api-keys/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" /> Add New Integration
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {providers.map((p) => {
            const row = rowByKey.get(p.key);
            const isConnected = !!row?.is_active;
            const updatedAt = formatUpdated(row?.updated_at);
            return (
              <Link
                key={p.key}
                to="/kali_master/api-keys/$provider"
                params={{ provider: p.key }}
                className="block group"
              >
                <Card className="border-border/50 h-full transition-colors group-hover:border-primary/40">
                  <CardHeader className="space-y-2">
                    <div className="flex flex-row items-start justify-between gap-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {p.label}
                        {p.isCustom && (
                          <Badge variant="outline" className="text-[10px]">
                            Custom
                          </Badge>
                        )}
                      </CardTitle>
                      <Badge
                        className={
                          isConnected
                            ? p.badgeClass
                            : "bg-muted text-muted-foreground hover:bg-muted"
                        }
                      >
                        {isConnected ? "Connected" : "Not Set"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                      {p.helpText}
                      {p.helpUrl && (
                        <>
                          {" "}
                          <a
                            href={p.helpUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-0.5 text-primary hover:underline"
                          >
                            Docs <ExternalLink className="w-3 h-3" />
                          </a>
                        </>
                      )}
                    </p>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between pt-0">
                    <div className="text-[11px] text-muted-foreground">
                      {updatedAt ? `Updated ${updatedAt}` : "Not configured yet"}
                      <div className="mt-0.5">
                        {p.fields.length} field
                        {p.fields.length === 1 ? "" : "s"}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}

          {providers.length === BUILTIN_PROVIDERS.length && (
            <Link to="/kali_master/api-keys/new" className="block">
              <Card className="border-dashed border-border h-full flex items-center justify-center hover:border-primary/50 transition-colors min-h-[160px]">
                <CardContent className="text-center pt-6">
                  <Plus className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Add a custom integration</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Store API keys for any third-party service
                  </p>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
