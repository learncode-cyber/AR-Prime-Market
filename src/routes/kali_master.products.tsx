import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Edit,
  Trash2,
  Download,
  RefreshCw,
  Upload,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { syncProductStock } from "@/lib/dropship.functions";
import { uploadImage } from "@/lib/image-upload.functions";
import { generateProductContent } from "@/lib/product-ai.functions";
import { recordSensitiveAccess } from "@/lib/audit-log";
import { prepareImageForUpload } from "@/lib/image-prepare";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LandingCopyPreview } from "@/components/admin/landing-copy/LandingCopyPreview";
import { detectMediaKind, toEmbedUrl, videoThumbnail } from "@/lib/media";
import { resolveStorageImageUrl } from "@/lib/storageImage";

export const Route = createFileRoute("/kali_master/products")({
  component: AdminProducts,
});

type TargetMarket = "bangladesh" | "worldwide";

type ProductForm = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  compare_at_price: number | null;
  stock_quantity: number;
  sku: string;
  category_id: string | null;
  gallery_urls: string;
  is_active: boolean;
  stock_status: "in_stock" | "out_of_stock" | "on_backorder";
  target_markets: TargetMarket[];
};

const empty: ProductForm = {
  title: "",
  slug: "",
  description: "",
  price: 0,
  currency: "USD",
  compare_at_price: null,
  stock_quantity: 0,
  sku: "",
  category_id: null,
  gallery_urls: "",
  is_active: true,
  stock_status: "in_stock",
  target_markets: ["bangladesh", "worldwide"],
};

const STOCK_LABELS: Record<string, { label: string; cls: string }> = {
  in_stock: { label: "In Stock", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  out_of_stock: { label: "Out of Stock", cls: "bg-red-500/15 text-red-600 border-red-500/30" },
  on_backorder: {
    label: "On Backorder",
    cls: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  },
};

function AdminProducts() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProductForm>(empty);
  const [saving, setSaving] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    done: number;
    total: number;
    current: string;
  } | null>(null);
  const [syncResults, setSyncResults] = useState<Record<
    string,
    { ok: number; fail: number; failedIds: string[] }
  > | null>(null);
  const [retryingProv, setRetryingProv] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [pricePct, setPricePct] = useState<string>("");
  const [bulkCategory, setBulkCategory] = useState<string>("");
  const [aiBusy, setAiBusy] = useState(false);
  const aiGenerate = useServerFn(generateProductContent);

  const { data: products, refetch } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, categories(name)")
        .order("created_at", { ascending: false });
      const rows = data || [];
      if (rows.length > 0) {
        recordSensitiveAccess({
          table_name: "products",
          fields: ["cogs", "supplier_url", "source_provider", "source_product_id"],
          record_ids: rows.map((r: { id: string }) => r.id).slice(0, 500),
          context: "admin:products list",
          row_count: rows.length,
        });
      }
      return rows;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["admin-categories-list"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, name").order("name");
      return data || [];
    },
  });

  const openCreate = () => {
    setForm(empty);
    setOpen(true);
  };
  const openEdit = (p: any) => {
    const tm =
      Array.isArray(p.target_markets) && p.target_markets.length > 0
        ? (p.target_markets as TargetMarket[])
        : (["bangladesh", "worldwide"] as TargetMarket[]);
    setForm({
      id: p.id,
      title: p.title,
      slug: p.slug,
      description: p.description || "",
      price: p.price,
      currency: p.currency || "USD",
      compare_at_price: p.compare_at_price,
      stock_quantity: p.stock_quantity,
      sku: p.sku || "",
      category_id: p.category_id,
      gallery_urls: (p.gallery_urls || []).join("\n"),
      is_active: p.is_active,
      stock_status: (p.stock_status as ProductForm["stock_status"]) || "in_stock",
      target_markets: tm,
    });
    setOpen(true);
  };

  const toggleMarket = (m: TargetMarket) => {
    setForm((f) => {
      const has = f.target_markets.includes(m);
      const next = has ? f.target_markets.filter((x) => x !== m) : [...f.target_markets, m];
      return { ...f, target_markets: next };
    });
  };

  const handleSave = async () => {
    if (!form.title || !form.slug) {
      toast.error("Title ও Slug দরকার");
      return;
    }
    if (form.target_markets.length === 0) {
      toast.error("Select at least one Target Market (Bangladesh / Worldwide)");
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title,
      slug: form.slug,
      description: form.description,
      price: Number(form.price),
      currency: form.currency,
      compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null,
      stock_quantity: Number(form.stock_quantity),
      sku: form.sku || null,
      category_id: form.category_id || null,
      gallery_urls: form.gallery_urls
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      is_active: form.is_active,
      stock_status: form.stock_status,
      target_markets: form.target_markets,
    };
    const { error } = form.id
      ? await supabase.from("products").update(payload).eq("id", form.id)
      : await supabase.from("products").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(form.id ? "Product updated" : "Product created");
    setOpen(false);
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      refetch();
    }
  };

  const syncFn = useServerFn(syncProductStock);
  const handleSync = async (id: string) => {
    try {
      const r = await syncFn({ data: { product_id: id } });
      toast.success(`Stock: ${r.old} → ${r.new}`);
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const runSync = async (
    target: any[],
    scopeLabel: string,
    mode: "fresh" | "retry",
    retryProv?: string,
  ) => {
    if (target.length === 0) {
      toast.info(`No ${scopeLabel} products to sync`);
      return;
    }
    if (mode === "fresh" && !confirm(`Sync stock for ${target.length} ${scopeLabel} products?`))
      return;
    if (mode === "retry") setRetryingProv(retryProv || scopeLabel);
    else setSyncingAll(true);
    if (mode === "fresh") setSyncResults(null);
    setSyncProgress({ done: 0, total: target.length, current: "" });
    const results: Record<string, { ok: number; fail: number; failedIds: string[] }> =
      mode === "retry" && syncResults ? { ...syncResults } : {};
    if (mode === "retry" && retryProv && results[retryProv]) {
      results[retryProv] = { ...results[retryProv], failedIds: [] };
    }
    for (let i = 0; i < target.length; i++) {
      const p = target[i];
      const prov = p.source_provider || "unknown";
      results[prov] = results[prov] || { ok: 0, fail: 0, failedIds: [] };
      setSyncProgress({ done: i, total: target.length, current: p.title });
      try {
        await syncFn({ data: { product_id: p.id } });
        results[prov].ok++;
      } catch {
        results[prov].fail++;
        results[prov].failedIds.push(p.id);
      }
      setSyncResults({ ...results });
    }
    setSyncProgress({ done: target.length, total: target.length, current: "" });
    setSyncingAll(false);
    setRetryingProv(null);
    const totalOk = Object.values(results).reduce((s, r) => s + r.ok, 0);
    const totalFail = Object.values(results).reduce((s, r) => s + r.fail, 0);
    toast.success(`Synced ${scopeLabel}: ${totalOk} ok, ${totalFail} failed`);
    refetch();
  };

  const handleSyncAll = async () => {
    const all = (products || []).filter((p: any) => p.source_provider);
    let target = all;
    let scopeLabel = "all imported";
    if (supplierFilter === "manual") {
      toast.info("Manual products have no supplier to sync from");
      return;
    }
    if (supplierFilter !== "all") {
      target = all.filter((p: any) => p.source_provider === supplierFilter);
      scopeLabel = supplierFilter;
    }
    await runSync(target, scopeLabel, "fresh");
  };

  const handleRetryFailed = async (prov: string) => {
    const failedIds = syncResults?.[prov]?.failedIds || [];
    if (failedIds.length === 0) {
      toast.info("No failed items to retry");
      return;
    }
    const target = (products || []).filter((p: any) => failedIds.includes(p.id));
    await runSync(target, `${prov} (retry)`, "retry", prov);
  };

  const suppliers = Array.from(
    new Set((products || []).map((p: any) => p.source_provider).filter(Boolean)),
  );
  const filtered = (products || []).filter((p: any) => {
    if (supplierFilter === "all") return true;
    if (supplierFilter === "manual") return !p.source_provider;
    return p.source_provider === supplierFilter;
  });

  // ───── Bulk operations ─────
  const allSelectedOnPage = filtered.length > 0 && filtered.every((p: any) => selected.has(p.id));
  const toggleSelectAll = () => {
    if (allSelectedOnPage) setSelected(new Set());
    else setSelected(new Set(filtered.map((p: any) => p.id)));
  };
  const toggleOne = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const ids = () => Array.from(selected);

  const bulkSetActive = async (is_active: boolean) => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const { error } = await supabase.from("products").update({ is_active }).in("id", ids());
    setBulkBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(`${selected.size} product(s) ${is_active ? "activated" : "deactivated"}`);
      setSelected(new Set());
      refetch();
    }
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const { error } = await supabase.from("products").delete().in("id", ids());
    setBulkBusy(false);
    setConfirmBulkDelete(false);
    if (error) toast.error(error.message);
    else {
      toast.success(`${selected.size} product(s) deleted`);
      setSelected(new Set());
      refetch();
    }
  };

  const bulkAdjustPrice = async () => {
    const pct = Number(pricePct);
    if (!pct || isNaN(pct)) {
      toast.error("Enter a % like 10 or -15");
      return;
    }
    if (selected.size === 0) return;
    setBulkBusy(true);
    const rows = (products || []).filter((p: any) => selected.has(p.id));
    const factor = 1 + pct / 100;
    const errors: string[] = [];
    for (const r of rows) {
      const newPrice = Math.max(0, Math.round((r.price || 0) * factor * 100) / 100);
      const { error } = await supabase.from("products").update({ price: newPrice }).eq("id", r.id);
      if (error) errors.push(error.message);
    }
    setBulkBusy(false);
    setPricePct("");
    if (errors.length) toast.error(`${errors.length} failed`);
    else toast.success(`Adjusted price for ${rows.length} product(s) by ${pct}%`);
    setSelected(new Set());
    refetch();
  };

  const bulkChangeCategory = async (categoryId: string) => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const { error } = await supabase
      .from("products")
      .update({ category_id: categoryId === "none" ? null : categoryId })
      .in("id", ids());
    setBulkBusy(false);
    setBulkCategory("");
    if (error) toast.error(error.message);
    else {
      toast.success(`Category updated for ${selected.size} product(s)`);
      setSelected(new Set());
      refetch();
    }
  };

  // ───── AI content generator ─────
  const runAiGenerate = async () => {
    setAiBusy(true);
    try {
      const cat = categories?.find((c) => c.id === form.category_id);
      const firstImage = form.gallery_urls
        .split("\n")
        .map((s) => s.trim())
        .find(Boolean);
      const result = await aiGenerate({
        data: {
          seedTitle: form.title || undefined,
          category: cat?.name || undefined,
          priceUSD: form.price > 0 ? Number(form.price) : undefined,
          imageUrl: firstImage && /^https?:\/\//.test(firstImage) ? firstImage : undefined,
        },
      });
      setForm((f) => ({
        ...f,
        title: result.title,
        description: result.description,
      }));
      toast.success("AI content generated — review & save");
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || "AI generation failed");
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} of {products?.length || 0} products
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="manual">Manual only</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleSyncAll} disabled={syncingAll}>
            <RefreshCw className={`w-4 h-4 mr-1 ${syncingAll ? "animate-spin" : ""}`} />
            {syncingAll
              ? "Syncing..."
              : supplierFilter === "all"
                ? "Sync All"
                : supplierFilter === "manual"
                  ? "Sync All"
                  : `Sync ${supplierFilter}`}
          </Button>
          <Link to="/kali_master/products/import">
            <Button variant="outline">
              <Download className="w-4 h-4 mr-1" /> Import
            </Button>
          </Link>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> Add Product
          </Button>
        </div>
      </div>

      {(syncProgress || syncResults) && (
        <Card className="border-border/50">
          <CardContent className="p-4 space-y-3">
            {syncProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">
                    {syncingAll ? "Syncing..." : "Sync complete"}
                    {syncProgress.current && (
                      <span className="text-muted-foreground ml-2 truncate">
                        {syncProgress.current}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {syncProgress.done} / {syncProgress.total}
                  </span>
                </div>
                <Progress
                  value={
                    syncProgress.total > 0 ? (syncProgress.done / syncProgress.total) * 100 : 0
                  }
                />
              </div>
            )}
            {syncResults && (
              <div className="flex flex-wrap gap-2 pt-1">
                {Object.entries(syncResults).map(([prov, r]) => (
                  <div
                    key={prov}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/50"
                  >
                    <Badge variant="outline" className="uppercase text-[10px]">
                      {prov}
                    </Badge>
                    <span className="text-xs text-emerald-600 font-medium">✓ {r.ok}</span>
                    {r.fail > 0 && (
                      <span className="text-xs text-red-500 font-medium">✗ {r.fail}</span>
                    )}
                    {r.failedIds.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] px-2 ml-1"
                        disabled={syncingAll || retryingProv !== null}
                        onClick={() => handleRetryFailed(prov)}
                      >
                        <RefreshCw
                          className={`w-3 h-3 mr-1 ${retryingProv === prov ? "animate-spin" : ""}`}
                        />
                        Retry {r.failedIds.length} failed
                      </Button>
                    )}
                  </div>
                ))}
                {!syncingAll && retryingProv === null && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setSyncResults(null);
                      setSyncProgress(null);
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 px-3 w-8">
                    <Checkbox
                      checked={allSelectedOnPage}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Product</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Price</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Stock</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Category
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product: any) => (
                  <tr
                    key={product.id}
                    className={`border-b border-border/50 hover:bg-secondary/30 ${selected.has(product.id) ? "bg-primary/5" : ""}`}
                  >
                    <td className="py-3 px-3">
                      <Checkbox
                        checked={selected.has(product.id)}
                        onCheckedChange={() => toggleOne(product.id)}
                        aria-label="Select row"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {product.gallery_urls?.[0] && (
                          <img
                            src={resolveStorageImageUrl(
                              product.gallery_urls[0],
                              "/placeholder.svg",
                              "product-images",
                            )}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover bg-secondary"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const img = e.currentTarget;
                              if (!img.src.endsWith("/placeholder.svg"))
                                img.src = "/placeholder.svg";
                            }}
                          />
                        )}
                        <div>
                          <p className="font-medium text-foreground">{product.title}</p>
                          <p className="text-xs text-muted-foreground">{product.sku || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium">৳{product.price}</p>
                      {product.compare_at_price && (
                        <p className="text-xs text-muted-foreground line-through">
                          ৳{product.compare_at_price}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={product.stock_quantity <= 5 ? "text-red-500 font-medium" : ""}
                        >
                          {product.stock_quantity}
                        </span>
                        {product.source_provider && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            title={`Sync from ${product.source_provider}`}
                            onClick={() => handleSync(product.id)}
                          >
                            <RefreshCw className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={`mt-1 text-[10px] ${STOCK_LABELS[product.stock_status || "in_stock"].cls}`}
                      >
                        {STOCK_LABELS[product.stock_status || "in_stock"].label}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        <Badge
                          variant={product.is_active ? "default" : "secondary"}
                          className="w-fit"
                        >
                          {product.is_active ? "Active" : "Draft"}
                        </Badge>
                        {product.source_provider && (
                          <Badge variant="outline" className="w-fit text-[10px] uppercase">
                            {product.source_provider}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {product.categories?.name || "—"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(product)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-2xl border border-border bg-card/95 backdrop-blur shadow-lg max-w-[95vw]">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button
            size="sm"
            variant="outline"
            disabled={bulkBusy}
            onClick={() => bulkSetActive(true)}
          >
            Activate
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={bulkBusy}
            onClick={() => bulkSetActive(false)}
          >
            Deactivate
          </Button>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              placeholder="±%"
              value={pricePct}
              onChange={(e) => setPricePct(e.target.value)}
              className="h-8 w-20"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={bulkBusy || !pricePct}
              onClick={bulkAdjustPrice}
            >
              Apply
            </Button>
          </div>
          <Select
            value={bulkCategory}
            onValueChange={(v) => {
              setBulkCategory(v);
              bulkChangeCategory(v);
            }}
          >
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue placeholder="Change category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="destructive"
            disabled={bulkBusy}
            onClick={() => setConfirmBulkDelete(true)}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      <AlertDialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} product(s)?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={bulkDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span>{form.id ? "Edit Product" : "New Product"}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={aiBusy}
                onClick={runAiGenerate}
                className="mr-6"
              >
                {aiBusy ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                )}
                AI Generate
              </Button>
            </DialogTitle>
          </DialogHeader>
          {form.id ? (
            <Tabs defaultValue="details">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="landing">📄 AI Landing Page Copy</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="mt-3">
                <ProductDetailsForm
                  form={form}
                  setForm={setForm}
                  categories={categories}
                  toggleMarket={toggleMarket}
                />
              </TabsContent>
              <TabsContent value="landing" className="mt-3">
                <LandingCopyPreview productId={form.id} productTitle={form.title} />
              </TabsContent>
            </Tabs>
          ) : (
            <ProductDetailsForm
              form={form}
              setForm={setForm}
              categories={categories}
              toggleMarket={toggleMarket}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function isLikelyValidUrl(s: string): boolean {
  if (!/^https?:\/\//i.test(s)) return false;
  try {
    const u = new URL(s);
    // Host must contain a dot — guards against malformed R2 URLs like
    // `https://i4aCdgu_QuzzpHA/foo.jpg` (raw account hash w/o domain).
    return u.hostname.includes(".") && !u.hostname.includes("_");
  } catch {
    return false;
  }
}

function GalleryPreviewGrid({
  urls,
  onRemove,
}: {
  urls: string;
  onRemove: (line: string) => void;
}) {
  const lines = urls
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
      {lines.map((line, i) => {
        const kind = detectMediaKind(line);
        const isVideo = kind === "youtube" || kind === "vimeo";
        const thumb = isVideo
          ? videoThumbnail(line)
          : resolveStorageImageUrl(line, "/placeholder.svg", "product-images");
        const broken = !isVideo && !isLikelyValidUrl(line);
        return (
          <div
            key={`${line}-${i}`}
            className="group relative aspect-square rounded-md overflow-hidden border border-border/60 bg-muted"
          >
            {isVideo && !thumb ? (
              <iframe
                src={toEmbedUrl(line)}
                className="w-full h-full"
                title={`media ${i + 1}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : broken ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-[10px] text-destructive px-2 text-center">
                <X className="w-4 h-4 mb-1" />
                Invalid URL
              </div>
            ) : (
              <img
                key={thumb || line}
                src={thumb || line}
                alt={`media ${i + 1}`}
                loading="lazy"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  if (!img.src.endsWith("/placeholder.svg")) {
                    img.src = "/placeholder.svg";
                    return;
                  }
                  img.style.opacity = "0.25";
                  img.title = "Image failed to load";
                }}
              />
            )}
            {isVideo && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-9 h-9 rounded-full bg-black/60 flex items-center justify-center">
                  <div className="w-0 h-0 border-l-[10px] border-l-white border-y-[6px] border-y-transparent ml-0.5" />
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => onRemove(line)}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
              aria-label="Remove"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate">
              {isVideo ? (kind === "youtube" ? "YouTube" : "Vimeo") : broken ? "Broken" : "Image"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GalleryUploadButton({
  slug,
  onUploaded,
}: {
  slug: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<"idle" | "optimizing" | "uploading">("idle");
  const busy = phase !== "idle";
  const upload = useServerFn(uploadImage);

  const handle = async (file: File) => {
    if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
      toast.error("Image only");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Max 15 MB");
      return;
    }
    setPhase("optimizing");
    try {
      const prepared = await prepareImageForUpload(file);
      setPhase("uploading");
      const ext = (prepared.filename.split(".").pop() || "jpg").toLowerCase();
      const path = `${slug}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { url, provider } = await upload({
        data: {
          base64: prepared.base64,
          filename: prepared.filename,
          contentType: prepared.contentType,
          fallbackBucket: "product-images",
          fallbackPath: path,
        },
      });
      onUploaded(url);
      toast.success(provider === "r2" ? "Uploaded to Cloudflare R2" : "Uploaded");
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || "Upload failed");
    } finally {
      setPhase("idle");
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
        ) : (
          <Upload className="w-3.5 h-3.5 mr-1" />
        )}
        {phase === "optimizing"
          ? "Optimizing…"
          : phase === "uploading"
            ? "Uploading…"
            : "Upload image"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
          e.target.value = "";
        }}
      />
    </>
  );
}

function ProductDetailsForm({
  form,
  setForm,
  categories,
  toggleMarket,
}: {
  form: ProductForm;
  setForm: (updater: ProductForm | ((prev: ProductForm) => ProductForm)) => void;
  categories: Array<{ id: string; name: string }> | undefined;
  toggleMarket: (m: TargetMarket) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Title</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <Label>Slug</Label>
          <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        </div>
      </div>
      <div>
        <Label>Description</Label>
        <Textarea
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div>
          <Label htmlFor="product-price">Price</Label>
          <div className="flex gap-1.5">
            <Input
              id="product-price"
              type="number"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: +e.target.value })}
            />
            <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
              <SelectTrigger className="w-[90px] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["USD", "BDT", "AED", "SAR", "EUR", "GBP", "CAD", "AUD"].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Enter the price in whichever currency you like — it converts live for every customer's
            display currency.
          </p>
        </div>
        <div>
          <Label>Compare Price</Label>
          <Input
            type="number"
            value={form.compare_at_price ?? ""}
            onChange={(e) =>
              setForm({ ...form, compare_at_price: e.target.value ? +e.target.value : null })
            }
          />
        </div>
        <div>
          <Label>Stock Qty</Label>
          <Input
            type="number"
            value={form.stock_quantity}
            onChange={(e) => setForm({ ...form, stock_quantity: +e.target.value })}
          />
        </div>
        <div>
          <Label>Stock Status</Label>
          <Select
            value={form.stock_status}
            onValueChange={(v: ProductForm["stock_status"]) =>
              setForm({ ...form, stock_status: v })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="in_stock">In Stock</SelectItem>
              <SelectItem value="out_of_stock">Out of Stock</SelectItem>
              <SelectItem value="on_backorder">On Backorder</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>SKU</Label>
          <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
        </div>
        <div>
          <Label>Category</Label>
          <Select
            value={form.category_id ?? "none"}
            onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? null : v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <Label>Gallery — image URLs or YouTube/Vimeo links (one per line)</Label>
          <GalleryUploadButton
            slug={form.slug || "product"}
            onUploaded={(url) =>
              setForm((f) => ({
                ...f,
                gallery_urls: f.gallery_urls ? `${f.gallery_urls}\n${url}` : url,
              }))
            }
          />
        </div>
        <Textarea
          rows={4}
          value={form.gallery_urls}
          onChange={(e) => setForm({ ...form, gallery_urls: e.target.value })}
          placeholder="https://example.com/image.jpg&#10;https://www.youtube.com/watch?v=..."
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          YouTube/Vimeo URLs (including /shorts/) render as embedded videos on the product page.
        </p>
        <GalleryPreviewGrid
          urls={form.gallery_urls}
          onRemove={(line) => {
            const next = form.gallery_urls
              .split(/\r?\n/)
              .filter((l) => l.trim() !== line.trim())
              .join("\n");
            setForm({ ...form, gallery_urls: next });
          }}
        />
      </div>

      <div className="rounded-md border border-border/60 p-3 space-y-2">
        <Label className="text-sm">Target Market / Shipping Zone</Label>
        <p className="text-[11px] text-muted-foreground">
          Bangladesh orders are auto-routed to SteadFast COD. Worldwide orders are auto-routed to
          the international supplier (CJ Dropshipping / AliExpress).
        </p>
        <div className="flex flex-wrap gap-4 pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={form.target_markets.includes("bangladesh")}
              onCheckedChange={() => toggleMarket("bangladesh")}
            />
            <span className="text-sm">🇧🇩 Bangladesh (SteadFast COD)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={form.target_markets.includes("worldwide")}
              onCheckedChange={() => toggleMarket("worldwide")}
            />
            <span className="text-sm">🌍 Worldwide (CJ / AliExpress)</span>
          </label>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={form.is_active}
          onCheckedChange={(v) => setForm({ ...form, is_active: v })}
        />
        <Label>Active</Label>
      </div>
    </div>
  );
}
