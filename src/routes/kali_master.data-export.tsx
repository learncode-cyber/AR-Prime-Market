import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Download, FileSpreadsheet, FileJson, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export const Route = createFileRoute("/kali_master/data-export")({
  component: DataExportPage,
});

type Dataset = {
  key: string;
  label: string;
  description: string;
  table: string;
  select?: string;
};

const DATASETS: Dataset[] = [
  {
    key: "orders",
    label: "Orders",
    description: "All store orders with customer + amount info",
    table: "orders",
  },
  {
    key: "order_items",
    label: "Order Items",
    description: "Line items for every order",
    table: "order_items",
  },
  { key: "products", label: "Products", description: "Product catalog", table: "products" },
  {
    key: "product_variants",
    label: "Product Variants",
    description: "Variant rows (size/color/etc.)",
    table: "product_variants",
  },
  { key: "categories", label: "Categories", description: "All categories", table: "categories" },
  { key: "profiles", label: "Customers", description: "Customer profiles", table: "profiles" },
  {
    key: "product_reviews",
    label: "Reviews",
    description: "Product reviews",
    table: "product_reviews",
  },
  { key: "coupons", label: "Coupons", description: "Discount coupons", table: "coupons" },
  {
    key: "abandoned_carts",
    label: "Abandoned Carts",
    description: "Carts left without checkout",
    table: "abandoned_carts",
  },
  {
    key: "wishlists",
    label: "Wishlists",
    description: "Customer wishlist items",
    table: "wishlists",
  },
  { key: "blog_posts", label: "Blog Posts", description: "Blog content", table: "blog_posts" },
  {
    key: "shipping_rates",
    label: "Shipping Rates",
    description: "Shipping config",
    table: "shipping_rates",
  },
];

async function fetchAll(table: string) {
  const pageSize = 1000;
  let from = 0;
  const all: any[] = [];
  for (;;) {
    const { data, error } = await (supabase as any)
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toCSV(rows: any[]): string {
  if (!rows.length) return "";
  const keys = Array.from(
    rows.reduce<Set<string>>((s, r) => {
      Object.keys(r || {}).forEach((k) => s.add(k));
      return s;
    }, new Set<string>()),
  );
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const str = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  const header = keys.join(",");
  const body = rows.map((r) => keys.map((k) => escape(r[k])).join(",")).join("\n");
  return header + "\n" + body;
}

function DatasetCard({ ds }: { ds: Dataset }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);

  const run = async (fmt: "csv" | "xlsx" | "json" | "pdf" | "sheets") => {
    setLoading(fmt);
    try {
      const rows = await fetchAll(ds.table);
      setCount(rows.length);
      const ts = new Date().toISOString().slice(0, 10);
      const base = `${ds.key}-${ts}`;

      if (fmt === "csv" || fmt === "sheets") {
        const csv = toCSV(rows);
        downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${base}.csv`);
        if (fmt === "sheets") {
          window.open("https://sheets.new", "_blank", "noopener");
          toast.success("CSV downloaded. In the new Google Sheet, use File → Import → Upload.");
        } else {
          toast.success(`Exported ${rows.length} rows to CSV`);
        }
      } else if (fmt === "xlsx") {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, ds.label.slice(0, 30));
        XLSX.writeFile(wb, `${base}.xlsx`);
        toast.success(`Exported ${rows.length} rows to XLSX`);
      } else if (fmt === "json") {
        downloadBlob(
          new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" }),
          `${base}.json`,
        );
        toast.success(`Exported ${rows.length} rows to JSON`);
      } else if (fmt === "pdf") {
        const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
        doc.setFontSize(14);
        doc.text(`${ds.label} — ${rows.length} rows`, 40, 40);
        doc.setFontSize(8);
        let y = 70;
        const lineHeight = 10;
        const maxWidth = 780;
        rows.slice(0, 500).forEach((r, i) => {
          const line = `${i + 1}. ${JSON.stringify(r).slice(0, 280)}`;
          const split = doc.splitTextToSize(line, maxWidth);
          split.forEach((l: string) => {
            if (y > 560) {
              doc.addPage();
              y = 40;
            }
            doc.text(l, 40, y);
            y += lineHeight;
          });
        });
        if (rows.length > 500) {
          doc.text(
            `… ${rows.length - 500} more rows truncated. Use CSV/XLSX for full data.`,
            40,
            y + 10,
          );
        }
        doc.save(`${base}.pdf`);
        toast.success(`Exported PDF (first 500 rows)`);
      }
    } catch (e: unknown) {
      console.error(e);
      toast.error((e instanceof Error ? e.message : String(e)) || "Export failed");
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>{ds.label}</span>
          {count !== null && (
            <span className="text-xs font-normal text-muted-foreground">{count} rows</span>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{ds.description}</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <Button size="sm" variant="outline" disabled={!!loading} onClick={() => run("csv")}>
            {loading === "csv" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            CSV
          </Button>
          <Button size="sm" variant="outline" disabled={!!loading} onClick={() => run("xlsx")}>
            {loading === "xlsx" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3 w-3" />
            )}
            Excel
          </Button>
          <Button size="sm" variant="outline" disabled={!!loading} onClick={() => run("json")}>
            {loading === "json" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FileJson className="h-3 w-3" />
            )}
            JSON
          </Button>
          <Button size="sm" variant="outline" disabled={!!loading} onClick={() => run("pdf")}>
            {loading === "pdf" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FileText className="h-3 w-3" />
            )}
            PDF
          </Button>
          <Button size="sm" disabled={!!loading} onClick={() => run("sheets")}>
            {loading === "sheets" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3 w-3" />
            )}
            Sheets
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DataExportPage() {
  const groups: Record<string, Dataset[]> = {
    sales: DATASETS.filter((d) =>
      ["orders", "order_items", "abandoned_carts", "coupons"].includes(d.key),
    ),
    catalog: DATASETS.filter((d) =>
      ["products", "product_variants", "categories", "shipping_rates"].includes(d.key),
    ),
    customers: DATASETS.filter((d) => ["profiles", "wishlists", "product_reviews"].includes(d.key)),
    content: DATASETS.filter((d) => ["blog_posts"].includes(d.key)),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Data Export</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Download your store data as CSV, Excel, JSON, or PDF. "Sheets" opens a new Google Sheet —
          then File → Import the CSV.
        </p>
      </div>

      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
        </TabsList>

        {Object.entries(groups).map(([key, items]) => (
          <TabsContent key={key} value={key} className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((ds) => (
                <DatasetCard key={ds.key} ds={ds} />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
