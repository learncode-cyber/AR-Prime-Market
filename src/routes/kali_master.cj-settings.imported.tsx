import { createFileRoute } from "@tanstack/react-router";
import { AdminPending, AdminErrorComponent, AdminNotFound } from "@/lib/admin-route-boundaries";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Trash2, Loader2, Package } from "lucide-react";
import { callProxy, type ImportedProduct } from "@/lib/cj-settings-shared";

export const Route = createFileRoute("/kali_master/cj-settings/imported")({
  pendingComponent: () => <AdminPending />,
  errorComponent: AdminErrorComponent,
  notFoundComponent: AdminNotFound,
  component: CjImportedSection,
});

function CjImportedSection() {
  const [imported, setImported] = useState<ImportedProduct[]>([]);
  const [loadingImported, setLoadingImported] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  const [perRowSync, setPerRowSync] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadImported();
    const ch = supabase
      .channel("cj-imported-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "imported_products" }, () =>
        loadImported(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  async function loadImported() {
    setLoadingImported(true);
    const { data, error } = await supabase
      .from("imported_products")
      .select(
        "id, cj_pid, product_name, product_image, sell_price, product_status, stock_info, last_synced_at",
      )
      .order("imported_at", { ascending: false });
    if (error) toast.error(error.message);
    else setImported((data || []) as ImportedProduct[]);
    setLoadingImported(false);
  }

  async function handleSync(pid: string) {
    setPerRowSync((m) => ({ ...m, [pid]: true }));
    try {
      await callProxy("syncProduct", { productId: pid });
      toast.success("Synced");
      loadImported();
    } catch (e: unknown) {
      toast.error(`Sync failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPerRowSync((m) => ({ ...m, [pid]: false }));
    }
  }

  async function handleSyncAll() {
    setSyncingAll(true);
    let ok = 0,
      fail = 0;
    for (const p of imported) {
      try {
        await callProxy("syncProduct", { productId: p.cj_pid });
        ok++;
      } catch {
        fail++;
      }
    }
    setSyncingAll(false);
    toast.success(`Synced ${ok} / ${imported.length} (${fail} failed)`);
    loadImported();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this imported product?")) return;
    const { error } = await supabase.from("imported_products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    loadImported();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="flex items-center gap-2">
          <Package className="w-4 h-4" /> Imported Products
          <Badge variant="secondary" className="ml-2">
            {imported.length}
          </Badge>
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSyncAll}
          disabled={syncingAll || !imported.length}
        >
          {syncingAll ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Sync All
        </Button>
      </CardHeader>
      <CardContent>
        {loadingImported ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : !imported.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No products imported yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border text-muted-foreground">
                  <th className="p-2">Image</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Price</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Stock</th>
                  <th className="p-2">Last Synced</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {imported.map((p) => {
                  const stockNum = (() => {
                    const si = p.stock_info as any;
                    if (!si) return "—";
                    if (typeof si === "number") return si;
                    if (typeof si.stock === "number") return si.stock;
                    if (Array.isArray(si?.list))
                      return si.list.reduce(
                        (s: number, x: any) => s + (Number(x?.stockNum || x?.stock) || 0),
                        0,
                      );
                    return "—";
                  })();
                  return (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="p-2">
                        <img
                          src={p.product_image || "/placeholder.svg"}
                          alt=""
                          className="w-12 h-12 object-cover rounded-sm"
                        />
                      </td>
                      <td className="p-2 max-w-xs">
                        <div className="line-clamp-2">{p.product_name}</div>
                        <div className="text-xs text-muted-foreground">PID: {p.cj_pid}</div>
                      </td>
                      <td className="p-2">${p.sell_price?.toFixed(2) ?? "—"}</td>
                      <td className="p-2">
                        {p.product_status === 3 ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600">On sale</Badge>
                        ) : (
                          <Badge variant="secondary">Off sale</Badge>
                        )}
                      </td>
                      <td className="p-2 font-mono text-xs">{stockNum}</td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {new Date(p.last_synced_at).toLocaleString()}
                      </td>
                      <td className="p-2 text-right space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSync(p.cj_pid)}
                          disabled={perRowSync[p.cj_pid]}
                        >
                          {perRowSync[p.cj_pid] ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
