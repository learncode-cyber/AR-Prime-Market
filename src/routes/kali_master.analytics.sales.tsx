import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/kali_master/analytics/sales")({
  component: SalesAnalytics,
});

function SalesAnalytics() {
  const { data } = useQuery({
    queryKey: ["analytics-sales"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("total_amount, status, created_at, currency");
      const orders = data || [];
      const delivered = orders.filter((o: any) => o.status === "delivered");
      const revenue = delivered.reduce((s: number, o: any) => s + (o.total_amount || 0), 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const last7 = new Date(today);
      last7.setDate(today.getDate() - 7);
      const last30 = new Date(today);
      last30.setDate(today.getDate() - 30);
      const sum = (since: Date) =>
        delivered
          .filter((o: any) => new Date(o.created_at) >= since)
          .reduce((s: number, o: any) => s + (o.total_amount || 0), 0);
      return {
        total: revenue,
        avg: delivered.length ? revenue / delivered.length : 0,
        last7: sum(last7),
        last30: sum(last30),
        count: delivered.length,
      };
    },
  });

  const fmt = (n: number) => `৳${Math.round(n).toLocaleString()}`;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sales</h1>
        <p className="text-sm text-muted-foreground mt-1">Revenue from delivered orders</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Lifetime</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{fmt(data?.total ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Last 30 days</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{fmt(data?.last30 ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Last 7 days</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{fmt(data?.last7 ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Avg order</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{fmt(data?.avg ?? 0)}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
