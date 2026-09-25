import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/kali_master/shipping-rates/zones")({
  component: Zones,
});

function Zones() {
  const { data } = useQuery({
    queryKey: ["shipping-zones"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("shipping_rates").select("*");
      const grouped: Record<string, any[]> = {};
      (data || []).forEach((r: any) => {
        grouped[r.zone_name] = grouped[r.zone_name] || [];
        grouped[r.zone_name].push(r);
      });
      return grouped;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Shipping Zones</h1>
        <p className="text-sm text-muted-foreground mt-1">Rates grouped by destination zone</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(data || {}).map(([zone, rates]) => (
          <Card key={zone}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>{zone}</span>
                <Badge variant="outline">
                  {rates.length} rate{rates.length === 1 ? "" : "s"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {rates.map((r: any) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between text-sm py-1.5 border-b border-border/40 last:border-0"
                >
                  <span className="capitalize">{r.shipping_type.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground">
                    ৳{r.base_cost} · {r.min_days}–{r.max_days}d
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
        {!Object.keys(data || {}).length && (
          <p className="text-sm text-muted-foreground col-span-2 text-center py-8">
            No zones configured yet
          </p>
        )}
      </div>
    </div>
  );
}
