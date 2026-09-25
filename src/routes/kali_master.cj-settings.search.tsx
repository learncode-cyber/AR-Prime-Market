import { createFileRoute } from "@tanstack/react-router";
import { AdminPending, AdminErrorComponent, AdminNotFound } from "@/lib/admin-route-boundaries";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Search, Loader2 } from "lucide-react";
import { callProxy, type CjListItem } from "@/lib/cj-settings-shared";

export const Route = createFileRoute("/kali_master/cj-settings/search")({
  pendingComponent: () => <AdminPending />,
  errorComponent: AdminErrorComponent,
  notFoundComponent: AdminNotFound,
  component: CjSearchSection,
});

function CjSearchSection() {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<CjListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState<Record<string, "idle" | "loading" | "done" | "error">>(
    {},
  );

  async function handleSearch() {
    setSearching(true);
    try {
      const res = await callProxy<any>("searchProducts", {
        params: { productNameEn: search, pageNum: 1, pageSize: 20 },
      });
      const list = res?.data?.list || res?.data || [];
      setSearchResults(Array.isArray(list) ? list : []);
      if (!list?.length) toast.info("No products found");
    } catch (e: unknown) {
      toast.error(`Search failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSearching(false);
    }
  }

  async function handleImport(pid: string) {
    setImporting((m) => ({ ...m, [pid]: "loading" }));
    try {
      await callProxy("importProduct", { productId: pid });
      setImporting((m) => ({ ...m, [pid]: "done" }));
      toast.success("Product imported");
    } catch (e: unknown) {
      setImporting((m) => ({ ...m, [pid]: "error" }));
      toast.error(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="w-4 h-4" /> Search & Import
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Search CJ products by keyword (English)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={searching}>
            {searching ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            Search
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {searchResults.map((p) => {
            const status = importing[p.pid] || "idle";
            return (
              <div key={p.pid} className="border border-border rounded-md p-3 flex gap-3 bg-card">
                <img
                  src={p.productImage || "/placeholder.svg"}
                  alt={p.productNameEn || p.productName}
                  className="w-20 h-20 object-cover rounded-sm bg-secondary/40 flex-shrink-0"
                />
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="text-sm font-medium line-clamp-2">
                    {p.productNameEn || p.productName}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    ${typeof p.sellPrice === "number" ? p.sellPrice.toFixed(2) : p.sellPrice || "—"}
                  </div>
                  <div className="mt-auto pt-2">
                    <Button
                      size="sm"
                      variant={status === "done" ? "secondary" : "default"}
                      disabled={status === "loading" || status === "done"}
                      onClick={() => handleImport(p.pid)}
                      className="w-full"
                    >
                      {status === "loading" && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                      {status === "done" ? "Imported" : status === "error" ? "Retry" : "Import"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {!searchResults.length && !searching && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Search CJ catalog to import products.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
