import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/kali_master/analytics/products")({
  component: ProductAnalytics,
});

function ProductAnalytics() {
  const { data } = useQuery({
    queryKey: ["analytics-products"],
    queryFn: async () => {
      const { data: items } = await supabase
        .from("order_items")
        .select("product_id, product_name, quantity, price");
      const map: Record<string, { name: string; qty: number; revenue: number }> = {};
      (items || []).forEach((i: any) => {
        const key = i.product_id || i.product_name;
        if (!key) return;
        map[key] = map[key] || { name: i.product_name || "Unknown", qty: 0, revenue: 0 };
        map[key].qty += i.quantity || 0;
        map[key].revenue += (i.quantity || 0) * (i.price || 0);
      });
      return Object.values(map)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 20);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Top Products</h1>
        <p className="text-sm text-muted-foreground mt-1">Best sellers by units sold</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 20</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.length ? (
            <div className="space-y-2">
              {data.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-border/40 last:border-0"
                >
                  <span className="text-sm truncate max-w-[60%]">
                    {i + 1}. {p.name}
                  </span>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">{p.qty} sold</span>
                    <span className="font-medium">৳{Math.round(p.revenue).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No product sales yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
