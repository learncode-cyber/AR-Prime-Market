import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/kali_master/analytics/traffic")({
  component: TrafficAnalytics,
});

function TrafficAnalytics() {
  const { data } = useQuery({
    queryKey: ["analytics-traffic"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("page_views")
        .select("path, created_at")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) return { total: 0, unique: 0, top: [] as { path: string; count: number }[] };
      const rows = data || [];
      const byPath: Record<string, number> = {};
      rows.forEach((r: any) => {
        byPath[r.path] = (byPath[r.path] || 0) + 1;
      });
      const top = Object.entries(byPath)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([path, count]) => ({ path, count }));
      return { total: rows.length, unique: Object.keys(byPath).length, top };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Traffic</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Recent page views (sample of last 2,000)
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Views</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data?.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Unique paths</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data?.unique ?? 0}</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top pages</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.top?.length ? (
            <div className="space-y-2">
              {data.top.map((t) => (
                <div
                  key={t.path}
                  className="flex items-center justify-between text-sm py-1.5 border-b border-border/40 last:border-0"
                >
                  <span className="font-mono text-xs truncate max-w-[70%]">{t.path}</span>
                  <span className="text-muted-foreground">{t.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No traffic data captured yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
