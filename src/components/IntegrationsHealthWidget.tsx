import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, ShieldAlert, ExternalLink } from "lucide-react";

interface CredRow {
  provider: string;
  label: string;
  credentials: Record<string, string>;
  is_active: boolean;
  updated_at: string | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  cj_dropshipping: "CJ Dropshipping",
  aliexpress: "AliExpress",
  steadfast: "SteadFast",
};

const PROVIDER_COLORS: Record<string, string> = {
  cj_dropshipping: "text-orange-500",
  aliexpress: "text-blue-500",
  steadfast: "text-green-500",
};

export function IntegrationsHealthWidget() {
  const { data: creds, isLoading } = useQuery({
    queryKey: ["api-credentials-health"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_credentials")
        .select("provider, label, credentials, is_active, updated_at");
      if (error) throw error;
      return (data || []) as CredRow[];
    },
    refetchInterval: 30000,
  });

  const providers = ["cj_dropshipping", "aliexpress", "steadfast"];

  function timeAgo(iso: string | null) {
    if (!iso) return "Never";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Integrations Health
        </CardTitle>
        <Link
          to="/kali_master/api-keys"
          className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
        >
          Manage <ExternalLink className="w-3 h-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex items-center gap-2 py-2 text-muted-foreground text-xs">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading…
          </div>
        ) : (
          providers.map((key) => {
            const row = creds?.find((c) => c.provider === key);
            const isSet = !!row?.is_active;
            const hasCreds =
              row?.credentials && Object.keys(row.credentials).some((k) => !!row.credentials[k]);
            const healthy = isSet && hasCreds;
            const label = PROVIDER_LABELS[key] || row?.label || key;
            const colorClass = PROVIDER_COLORS[key] || "text-muted-foreground";

            return (
              <div
                key={key}
                className="flex items-center justify-between py-1.5 px-2 rounded-md bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${healthy ? "bg-emerald-500" : "bg-red-500"}`}
                  />
                  <span className="text-sm font-medium text-foreground">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {healthy ? (
                    <ShieldCheck className={`w-4 h-4 ${colorClass}`} />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-red-500" />
                  )}
                  <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0">
                    {timeAgo(row?.updated_at || null)}
                  </Badge>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
