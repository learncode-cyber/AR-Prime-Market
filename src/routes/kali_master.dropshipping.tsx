import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Download,
  DollarSign,
  Factory,
} from "lucide-react";
import { syncProductStock } from "@/lib/dropship.functions";
import { recordSensitiveAccess } from "@/lib/audit-log";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/kali_master/dropshipping")({
  component: DropshippingDashboard,
});

function DropshippingDashboard() {
  const [syncingAll, setSyncingAll] = useState(false);

  const { data: products, refetch: refetchProducts } = useQuery({
    queryKey: ["ds-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select(
          "id, title, price, cogs, stock_quantity, stock_status, source_provider, source_product_id, last_stock_sync, gallery_urls",
        )
        .order("created_at", { ascending: false });
      const rows = data || [];
      if (rows.length > 0) {
        recordSensitiveAccess({
          table_name: "products",
          fields: ["cogs", "source_provider", "source_product_id"],
          record_ids: rows.map((r) => r.id).slice(0, 500),
          context: "admin:dropshipping dashboard",
          row_count: rows.length,
        });
      }
      return rows;
    },
  });

  const { data: logs } = useQuery({
    queryKey: ["ds-import-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("import_logs")
        .select("*")
        .order("imported_at", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  const { data: orderItems } = useQuery({
    queryKey: ["ds-order-items-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("order_items")
        .select("unit_price, quantity, cogs, supplier_product_id");
      const rows = data || [];
      if (rows.length > 0) {
        recordSensitiveAccess({
          table_name: "order_items",
          fields: ["cogs", "supplier_product_id"],
          context: "admin:dropshipping margin stats",
          row_count: rows.length,
        });
      }
      return rows;
    },
  });

  const imported = (products || []).filter((p) => p.source_provider);
  const lowStock = (products || []).filter(
    (p) => (p.stock_quantity ?? 0) > 0 && (p.stock_quantity ?? 0) <= 5,
  );
  const outOfStock = (products || []).filter(
    (p) => p.stock_status === "out_of_stock" || (p.stock_quantity ?? 0) === 0,
  );

  const supplierBreakdown = imported.reduce((acc: Record<string, number>, p) => {
    const k = p.source_provider || "unknown";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  const totalRevenue = (orderItems || []).reduce(
    (s, i) => s + Number(i.unit_price || 0) * (i.quantity || 0),
    0,
  );
  const totalCogs = (orderItems || []).reduce(
    (s, i) => s + Number(i.cogs || 0) * (i.quantity || 0),
    0,
  );
  const profit = totalRevenue - totalCogs;
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  const syncFn = useServerFn(syncProductStock);
  const handleSyncAll = async () => {
    if (!confirm(`Sync stock for ${imported.length} imported products?`)) return;
    setSyncingAll(true);
    let ok = 0,
      fail = 0;
    for (const p of imported) {
      try {
        await syncFn({ data: { product_id: p.id } });
        ok++;
      } catch {
        fail++;
      }
    }
    setSyncingAll(false);
    toast.success(`Synced: ${ok} ok, ${fail} failed`);
    refetchProducts();
  };

  const cards = [
    { title: "Imported Products", value: imported.length, icon: Package, color: "text-blue-500" },
    {
      title: "Low Stock (≤5)",
      value: lowStock.length,
      icon: AlertTriangle,
      color: "text-amber-500",
    },
    { title: "Out of Stock", value: outOfStock.length, icon: AlertTriangle, color: "text-red-500" },
    {
      title: "Total Revenue",
      value: `৳${totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: "text-emerald-500",
    },
    {
      title: "Profit",
      value: `৳${profit.toLocaleString()}`,
      icon: TrendingUp,
      color: profit >= 0 ? "text-emerald-500" : "text-red-500",
    },
    {
      title: "Avg Margin",
      value: `${margin.toFixed(1)}%`,
      icon: TrendingUp,
      color: "text-purple-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dropshipping Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Imported product analytics, stock sync, supplier breakdown
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/kali_master/importer">
            <Button variant="outline">
              <Download className="w-4 h-4 mr-1" /> Import
            </Button>
          </Link>
          <Button onClick={handleSyncAll} disabled={syncingAll || imported.length === 0}>
            <RefreshCw className={`w-4 h-4 mr-1 ${syncingAll ? "animate-spin" : ""}`} />
            {syncingAll ? "Syncing..." : "Sync All Stock"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {cards.map((c) => (
          <Card key={c.title} className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">{c.title}</CardTitle>
              <c.icon className={`w-4 h-4 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Factory className="w-4 h-4" /> Supplier Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(supplierBreakdown).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No imported products yet
              </p>
            ) : (
              <div className="space-y-2">
                {Object.entries(supplierBreakdown).map(([provider, count]) => (
                  <div
                    key={provider}
                    className="flex items-center justify-between p-2 rounded-lg bg-secondary/40"
                  >
                    <Badge variant="outline" className="uppercase">
                      {provider}
                    </Badge>
                    <span className="text-sm font-medium">{count} products</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                All stock levels healthy
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {lowStock.slice(0, 10).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-secondary/40"
                  >
                    {p.gallery_urls?.[0] && (
                      <img
                        src={p.gallery_urls[0]}
                        alt=""
                        className="w-8 h-8 rounded object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.source_provider || "manual"}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-amber-500/15 text-amber-600 border-amber-500/30"
                    >
                      {p.stock_quantity} left
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Recent Imports</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!logs?.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No imports yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">
                      Source
                    </th>
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">
                      External ID
                    </th>
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-border/50 hover:bg-secondary/30">
                      <td className="py-2 px-4 text-muted-foreground text-xs">
                        {log.imported_at ? new Date(log.imported_at).toLocaleString() : "—"}
                      </td>
                      <td className="py-2 px-4">
                        <Badge variant="outline" className="uppercase text-[10px]">
                          {log.source}
                        </Badge>
                      </td>
                      <td className="py-2 px-4 font-mono text-xs">{log.external_id || "—"}</td>
                      <td className="py-2 px-4">
                        <Badge
                          variant="outline"
                          className={
                            log.status === "success"
                              ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                              : "bg-red-500/15 text-red-600 border-red-500/30"
                          }
                        >
                          {log.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
