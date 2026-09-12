import { createFileRoute } from "@tanstack/react-router";
import { AdminPending, AdminErrorComponent, AdminNotFound } from "@/lib/admin-route-boundaries";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getLatestScan } from "@/lib/seo-scan.functions";
import { sevIcon } from "@/lib/seo-audit-shared";

export const Route = createFileRoute("/kali_master/seo-audit/findings")({
  pendingComponent: () => <AdminPending />,
  errorComponent: AdminErrorComponent,
  notFoundComponent: AdminNotFound,
  component: FindingsTab,
});

function FindingsTab() {
  const latestFn = useServerFn(getLatestScan);
  const latest = useQuery({ queryKey: ["seo-latest"], queryFn: () => latestFn() });
  const findings = (latest.data?.findings ?? []) as Array<{
    id: string;
    url: string;
    category: string;
    severity: string;
    check_id: string;
    message: string;
    fix_hint: string | null;
  }>;

  const byCategory = findings.reduce<Record<string, typeof findings>>((acc, f) => {
    (acc[f.category] ||= []).push(f);
    return acc;
  }, {});

  if (Object.keys(byCategory).length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        No findings yet. Click <strong>Run scan now</strong> above to start.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(byCategory).map(([cat, items]) => (
        <Card key={cat} className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            {cat} <Badge variant="outline">{items.length}</Badge>
          </h3>
          <div className="space-y-2">
            {items.map((f) => (
              <div
                key={f.id}
                className="flex items-start gap-3 text-sm border-l-2 border-border pl-3 py-1"
              >
                {sevIcon(f.severity)}
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{f.message}</div>
                  <div className="text-xs text-muted-foreground truncate">{f.url}</div>
                  {f.fix_hint && (
                    <div className="text-xs text-muted-foreground italic mt-0.5">
                      Hint: {f.fix_hint}
                    </div>
                  )}
                </div>
                <code className="text-[10px] text-muted-foreground hidden md:block">
                  {f.check_id}
                </code>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
