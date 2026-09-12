import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/kali_master/analytics/")({
  component: AdminAnalytics,
});

function AdminAnalytics() {
  const { data } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("total_amount, status, created_at, currency");
      const allOrders = orders || [];

      const delivered = allOrders.filter((o) => o.status === "delivered");
      const revenue = delivered.reduce((s, o) => s + (o.total_amount || 0), 0);
      const avgOrder = delivered.length ? revenue / delivered.length : 0;

      const byStatus: Record<string, number> = {};
      allOrders.forEach((o) => {
        byStatus[o.status || "unknown"] = (byStatus[o.status || "unknown"] || 0) + 1;
      });

      return {
        totalRevenue: revenue,
        avgOrder,
        ordersByStatus: byStatus,
        totalOrders: allOrders.length,
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Store performance overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Delivered Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">৳{(data?.totalRevenue || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Average Order</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">৳{(data?.avgOrder || 0).toFixed(0)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data?.totalOrders || 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Orders by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(data?.ordersByStatus || {}).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm capitalize text-foreground">{status}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${((count as number) / (data?.totalOrders || 1)) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{count as number}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
