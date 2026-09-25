import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package,
  ShoppingCart,
  Users,
  DollarSign,
  TrendingUp,
  Sun,
  AlertTriangle,
  Clock,
  Star,
} from "lucide-react";
import { IntegrationsHealthWidget } from "@/components/IntegrationsHealthWidget";
import { toast } from "sonner";

export const Route = createFileRoute("/kali_master/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [products, orders, profiles] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id, total_amount, status, created_at"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);

      const orderData = orders.data || [];
      const totalRevenue = orderData.reduce((s, o) => s + (o.total_amount || 0), 0);
      const pendingOrders = orderData.filter((o) => o.status === "pending").length;

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const todaysRevenue = orderData
        .filter((o) => o.created_at && new Date(o.created_at) >= startOfDay)
        .reduce((s, o) => s + (o.total_amount || 0), 0);

      return {
        totalProducts: products.count || 0,
        totalOrders: orderData.length,
        totalCustomers: profiles.count || 0,
        totalRevenue,
        pendingOrders,
        todaysRevenue,
      };
    },
  });

  // Realtime: invalidate stats + toast on new orders
  const lastToastedId = useRef<string | null>(null);
  useEffect(() => {
    const channel = supabase
      .channel("admin-orders-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        const row = payload.new as {
          id?: string;
          order_number?: string | null;
          total_amount?: number | null;
        };
        if (row?.id && row.id !== lastToastedId.current) {
          lastToastedId.current = row.id;
          toast.success(
            `New order ${row.order_number || row.id.slice(0, 8)} — ৳${(row.total_amount || 0).toLocaleString()}`,
          );
        }
        queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
        queryClient.invalidateQueries({ queryKey: ["admin-recent-orders"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
        queryClient.invalidateQueries({ queryKey: ["admin-recent-orders"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const cards = [
    {
      title: "Today's Revenue",
      value: `৳${(stats?.todaysRevenue || 0).toLocaleString()}`,
      icon: Sun,
      color: "text-amber-500",
    },
    {
      title: "Total Revenue",
      value: `৳${(stats?.totalRevenue || 0).toLocaleString()}`,
      icon: DollarSign,
      color: "text-emerald-500",
    },
    {
      title: "Total Orders",
      value: stats?.totalOrders || 0,
      icon: ShoppingCart,
      color: "text-blue-500",
    },
    {
      title: "Products",
      value: stats?.totalProducts || 0,
      icon: Package,
      color: "text-purple-500",
    },
    {
      title: "Customers",
      value: stats?.totalCustomers || 0,
      icon: Users,
      color: "text-orange-500",
    },
    {
      title: "Pending Orders",
      value: stats?.pendingOrders || 0,
      icon: TrendingUp,
      color: "text-red-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Overview of your store</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Live
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {cards.map((card) => (
          <Card key={card.title} className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RecentOrders />
        </div>
        <div className="space-y-4">
          <SmartAlerts />
          <IntegrationsHealthWidget />
        </div>
      </div>
    </div>
  );
}

function RecentOrders() {
  const { data: orders } = useQuery({
    queryKey: ["admin-recent-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Recent Orders</CardTitle>
      </CardHeader>
      <CardContent>
        {!orders?.length ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No orders yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                    Order ID
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Amount</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-border/50 hover:bg-secondary/30 animate-in fade-in duration-300"
                  >
                    <td className="py-2.5 px-2 font-mono text-xs">{order.id.slice(0, 8)}…</td>
                    <td className="py-2.5 px-2">৳{order.total_amount.toLocaleString()}</td>
                    <td className="py-2.5 px-2">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          order.status === "delivered"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : order.status === "pending"
                              ? "bg-yellow-500/10 text-yellow-500"
                              : order.status === "cancelled"
                                ? "bg-red-500/10 text-red-500"
                                : "bg-blue-500/10 text-blue-500"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-muted-foreground">
                      {new Date(order.created_at!).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SmartAlerts() {
  const { data } = useQuery({
    queryKey: ["admin-smart-alerts"],
    queryFn: async () => {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [lowStock, oldPending, unapprovedReviews] = await Promise.all([
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .lt("stock_quantity", 5)
          .eq("is_active", true),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .lt("created_at", dayAgo),
        supabase
          .from("product_reviews")
          .select("id", { count: "exact", head: true })
          .eq("is_approved", false),
      ]);
      return {
        lowStock: lowStock.count || 0,
        oldPending: oldPending.count || 0,
        unapprovedReviews: unapprovedReviews.count || 0,
      };
    },
    refetchInterval: 60_000,
  });

  const items = [
    {
      label: "Low stock products",
      value: data?.lowStock || 0,
      icon: AlertTriangle,
      color: "text-red-500",
      to: "/kali_master/products" as const,
    },
    {
      label: "Pending > 24h",
      value: data?.oldPending || 0,
      icon: Clock,
      color: "text-amber-500",
      to: "/kali_master/orders" as const,
    },
    {
      label: "Reviews to approve",
      value: data?.unapprovedReviews || 0,
      icon: Star,
      color: "text-blue-500",
      to: "/kali_master/reviews" as const,
    },
  ];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Smart Alerts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((it) => (
          <Link
            key={it.label}
            to={it.to}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm">
              <it.icon className={`w-4 h-4 ${it.color}`} />
              <span className="text-foreground">{it.label}</span>
            </div>
            <span
              className={`text-sm font-bold ${it.value > 0 ? it.color : "text-muted-foreground"}`}
            >
              {it.value}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
