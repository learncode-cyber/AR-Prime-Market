import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Activity,
  Eye,
  Package,
  ShoppingCart,
  CreditCard,
  DollarSign,
  RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/kali_master/meta-analytics")({
  component: MetaAnalyticsPage,
});

type Insights = {
  range: { days: number; since: number; until: number };
  totals: Record<string, number>;
  daily: Array<Record<string, number | string>>;
  capi: { active: boolean };
  meta_error: string | null;
};

const EVENT_META = [
  { key: "PageView", label: "Page Views", icon: Eye, color: "hsl(var(--primary))" },
  { key: "ViewContent", label: "View Content", icon: Package, color: "hsl(217 91% 60%)" },
  { key: "AddToCart", label: "Add to Cart", icon: ShoppingCart, color: "hsl(38 92% 50%)" },
  { key: "InitiateCheckout", label: "Checkouts", icon: CreditCard, color: "hsl(280 70% 55%)" },
  { key: "Purchase", label: "Purchases", icon: DollarSign, color: "hsl(142 71% 45%)" },
] as const;

function MetaAnalyticsPage() {
  const [days, setDays] = useState<7 | 30>(7);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["meta-insights", days],
    queryFn: async (): Promise<Insights> => {
      const { data, error } = await supabase.functions.invoke("meta-insights", {
        body: { days },
      });
      if (error) throw error;
      return data as Insights;
    },
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meta Marketing Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live Meta Pixel & Conversions API performance — no Business Manager needed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border overflow-hidden">
            {[7, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d as 7 | 30)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  days === d
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-secondary"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* CAPI Status */}
      <Card className="border-border/50">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">CAPI Pipeline</p>
              <p className="text-xs text-muted-foreground">
                Supabase Edge Function → Meta Conversions API
              </p>
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-20" />
          ) : data?.capi.active ? (
            <Badge className="bg-green-500/15 text-green-600 border-green-500/30 hover:bg-green-500/20">
              ● Active
            </Badge>
          ) : (
            <Badge variant="destructive">● Down</Badge>
          )}
        </CardContent>
      </Card>

      {data?.meta_error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3 text-sm text-destructive">
            Meta API: {data.meta_error}
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {EVENT_META.map(({ key, label, icon: Icon, color }) => (
          <Card key={key} className="border-border/50">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs text-muted-foreground font-medium">{label}</CardTitle>
              <Icon className="h-4 w-4" style={{ color }} />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <p className="text-2xl font-bold text-foreground">
                  {(data?.totals[key] || 0).toLocaleString()}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">last {days} days</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily Chart */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Daily Event Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-80 w-full" />
          ) : !data?.daily || data.daily.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-sm text-muted-foreground">
              No daily data available from Meta for this range.
            </div>
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.daily} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {EVENT_META.map(({ key, color }) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
