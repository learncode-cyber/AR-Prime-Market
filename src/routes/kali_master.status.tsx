import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  ShieldAlert,
  Route as RouteIcon,
  Lock,
  Users,
  CheckCircle,
  XCircle,
  Server,
} from "lucide-react";

export const Route = createFileRoute("/kali_master/status")({
  component: AdminStatusPage,
});

interface HealthResult {
  name: string;
  status: "pass" | "fail" | "warn";
  detail?: string;
}

function AdminStatusPage() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const [checks, setChecks] = useState<HealthResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const runChecks = async () => {
      const results: HealthResult[] = [];

      // 1. Route sanity
      const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
      results.push({
        name: "Route Mount",
        status: currentPath.startsWith("/kali_master") ? "pass" : "fail",
        detail: currentPath,
      });

      // 2. Role check
      results.push({
        name: "Admin Role",
        status: isAdmin ? "pass" : "fail",
        detail: isAdmin ? `uid=${user?.id?.slice(0, 12)}…` : "User is not admin",
      });

      // 3. Auth session
      const { data: sessionData } = await supabase.auth.getSession();
      results.push({
        name: "Auth Session",
        status: sessionData.session ? "pass" : "fail",
        detail: sessionData.session
          ? `expires ${new Date(sessionData.session.expires_at! * 1000).toLocaleTimeString()}`
          : "No active session",
      });

      // 4. RLS: user_roles read (admin-only table)
      try {
        const { data: roles, error } = await supabase.from("user_roles").select("role").limit(1);
        results.push({
          name: "RLS user_roles",
          status: !error ? "pass" : "fail",
          detail: error ? error.message : `${roles?.length ?? 0} row(s) accessible`,
        });
      } catch (e: unknown) {
        results.push({
          name: "RLS user_roles",
          status: "fail",
          detail: e instanceof Error ? e.message : String(e),
        });
      }

      // 5. RLS: integration_secrets read (admin-only)
      try {
        const { data: secrets, error } = await supabase
          .from("integration_secrets")
          .select("provider")
          .limit(1);
        results.push({
          name: "RLS integration_secrets",
          status: !error ? "pass" : "fail",
          detail: error ? error.message : `${secrets?.length ?? 0} row(s) accessible`,
        });
      } catch (e: unknown) {
        results.push({
          name: "RLS integration_secrets",
          status: "fail",
          detail: e instanceof Error ? e.message : String(e),
        });
      }

      // 6. RLS: profiles read (authenticated)
      try {
        const { data: profiles, error } = await supabase.from("profiles").select("id").limit(1);
        results.push({
          name: "RLS profiles",
          status: !error ? "pass" : "fail",
          detail: error ? error.message : `${profiles?.length ?? 0} row(s) accessible`,
        });
      } catch (e: unknown) {
        results.push({
          name: "RLS profiles",
          status: "fail",
          detail: e instanceof Error ? e.message : String(e),
        });
      }

      // 7. Admin write test on integration_secrets (insert + delete)
      try {
        const { error: insertErr } = await supabase.from("integration_secrets").insert({
          provider: "__health_test__",
          api_key: "test",
        });
        if (!insertErr) {
          await supabase
            .from("integration_secrets")
            .delete()
            .eq("provider", "__health_test__")
            .eq("api_key", "test");
        }
        results.push({
          name: "RLS write integration_secrets",
          status: !insertErr ? "pass" : "fail",
          detail: insertErr ? insertErr.message : "Insert + delete succeeded",
        });
      } catch (e: unknown) {
        results.push({
          name: "RLS write integration_secrets",
          status: "fail",
          detail: e instanceof Error ? e.message : String(e),
        });
      }

      setChecks(results);
      setLoading(false);
    };

    runChecks();
  }, [isAdmin, user]);

  const passCount = checks.filter((c) => c.status === "pass").length;
  const failCount = checks.filter((c) => c.status === "fail").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Status</h1>
          <p className="text-sm text-muted-foreground mt-1">Routing, role, and RLS health checks</p>
        </div>
        <Badge variant={failCount === 0 ? "default" : "destructive"}>
          {failCount === 0 ? "Healthy" : `${failCount} Issue${failCount > 1 ? "s" : ""}`}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <RouteIcon className="w-4 h-4 text-blue-500" />
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Route Checks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {checks.filter((c) => c.name.includes("Route") || c.name.includes("RPC")).length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Routing + RPC health</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Users className="w-4 h-4 text-purple-500" />
            <CardTitle className="text-sm font-medium text-muted-foreground">Auth / Role</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {checks.filter((c) => c.name.includes("Role") || c.name.includes("Session")).length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Admin + session status</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Lock className="w-4 h-4 text-emerald-500" />
            <CardTitle className="text-sm font-medium text-muted-foreground">RLS Checks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {checks.filter((c) => c.name.includes("RLS")).length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Table policy enforcement</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Server className="w-5 h-5 text-muted-foreground" />
            Detailed Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground py-4">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Running health checks…
            </div>
          ) : (
            <div className="space-y-3">
              {checks.map((check) => (
                <div
                  key={check.name}
                  className="flex items-start justify-between rounded-lg border border-border/50 p-3 bg-secondary/20"
                >
                  <div className="flex items-center gap-3">
                    {check.status === "pass" ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : check.status === "warn" ? (
                      <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">{check.name}</p>
                      {check.detail && (
                        <p className="text-xs text-muted-foreground mt-0.5 break-all">
                          {check.detail}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant={
                      check.status === "pass"
                        ? "default"
                        : check.status === "warn"
                          ? "secondary"
                          : "destructive"
                    }
                    className="shrink-0"
                  >
                    {check.status.toUpperCase()}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {!loading && (
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>All checks executed client-side via Supabase RLS. No server bypass used.</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
