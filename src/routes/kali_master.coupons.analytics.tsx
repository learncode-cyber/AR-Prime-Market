import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/kali_master/coupons/analytics")({
  component: CouponAnalytics,
});

function CouponAnalytics() {
  const { data } = useQuery({
    queryKey: ["coupon-analytics"],
    queryFn: async () => {
      const { data: coupons } = await supabase.from("coupons").select("*");
      const all = coupons || [];
      return {
        total: all.length,
        active: all.filter((c: any) => c.is_active).length,
        expired: all.filter((c: any) => c.expires_at && new Date(c.expires_at) < new Date()).length,
        list: all,
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Coupon Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Coupon usage এবং performance</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data?.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-500">{data?.active ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-muted-foreground">{data?.expired ?? 0}</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Coupons</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data?.list?.map((c: any) => (
              <div
                key={c.id}
                className="flex items-center justify-between py-2 border-b border-border/40 last:border-0"
              >
                <span className="font-mono font-semibold">{c.code}</span>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {c.discount_type === "percentage"
                      ? `${c.discount_value}%`
                      : `৳${c.discount_value}`}
                  </span>
                  <Badge variant={c.is_active ? "default" : "secondary"}>
                    {c.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            ))}
            {!data?.list?.length && (
              <p className="text-sm text-muted-foreground text-center py-8">No coupons yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
