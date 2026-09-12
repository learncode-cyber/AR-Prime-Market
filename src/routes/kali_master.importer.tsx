import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProductImporter } from "@/hooks/useProductImporter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/kali_master/importer")({
  component: ImporterPage,
});

interface ImportLog {
  id: string;
  source: string;
  external_id: string | null;
  status: string;
  product_id: string | null;
  imported_at: string;
  error_message: string | null;
}

function marginBadgeClass(pct: number) {
  if (pct >= 60) return "bg-green-500 hover:bg-green-600";
  if (pct >= 40) return "bg-yellow-500 hover:bg-yellow-600";
  return "bg-red-500 hover:bg-red-600";
}

function ImporterPage() {
  const {
    source,
    setSource,
    inputValue,
    setInputValue,
    isLoading,
    previewData,
    error,
    handleFetchPreview,
    handleConfirmImport,
  } = useProductImporter();

  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  async function loadLogs() {
    setLogsLoading(true);
    const { data } = await supabase
      .from("import_logs")
      .select("id, source, external_id, status, product_id, imported_at, error_message")
      .order("imported_at", { ascending: false })
      .limit(10);
    setLogs((data as ImportLog[]) || []);
    setLogsLoading(false);
  }

  useEffect(() => {
    loadLogs();
  }, []);

  // Refresh logs after a successful preview/import
  useEffect(() => {
    if (previewData) loadLogs();
  }, [previewData]);

  const placeholder =
    source === "cj_dropshipping"
      ? "e.g., 123456789ABC or product detail URL"
      : "e.g., 1005003... or aliexpress.com/item/...";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">1-Click Product Importer</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Import a product from supported suppliers with auto-calculated pricing
        </p>
      </div>

      {/* Input panel */}
      <Card className="border-border/50">
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Source Platform</Label>
              <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cj_dropshipping">🟠 CJ Dropshipping</SelectItem>
                  <SelectItem value="aliexpress">🔴 AliExpress</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Product URL or Product ID</Label>
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={placeholder}
              />
            </div>
          </div>

          <Button
            onClick={handleFetchPreview}
            disabled={!inputValue.trim() || isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Fetching...
              </>
            ) : (
              "Fetch & Preview →"
            )}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      {previewData && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Product Imported — Review & Publish
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                {previewData.image_url ? (
                  <img
                    src={previewData.image_url}
                    alt={previewData.title}
                    className="w-[200px] h-[200px] rounded-lg object-cover border border-border"
                  />
                ) : (
                  <div className="w-[200px] h-[200px] rounded-lg bg-muted" />
                )}
                <h3 className="font-semibold text-base">{previewData.title}</h3>
                <Badge
                  className={
                    source === "cj_dropshipping"
                      ? "bg-orange-500 hover:bg-orange-600"
                      : "bg-red-500 hover:bg-red-600"
                  }
                >
                  {source === "cj_dropshipping" ? "CJ Dropshipping" : "AliExpress"}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="font-medium mb-2">Auto-Calculated Pricing</div>
                <PriceRow label="Cost (COGS)" value={`$${previewData.cogs.toFixed(2)}`} />
                <PriceRow label="Shipping Cost" value="$3.99" />
                <PriceRow label="Formula" value="(COGS × 3) + Shipping" italic />
                <div className="border-t border-border my-2" />
                <PriceRow
                  label="Retail Price"
                  value={`$${previewData.retail_price.toFixed(2)}`}
                  valueClass="text-green-600 font-bold text-lg"
                />
                <PriceRow
                  label="Compare Price"
                  value={`$${previewData.compare_price.toFixed(2)}`}
                  valueClass="text-muted-foreground line-through"
                />
                <div className="flex justify-between items-center py-1">
                  <span className="text-sm">Your Margin</span>
                  <Badge className={marginBadgeClass(Number(previewData.margin_percent))}>
                    {previewData.margin_percent}%
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground pt-2">
                  {previewData.variant_count} variants found
                </div>
              </div>
            </div>

            <Button
              onClick={handleConfirmImport}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              size="lg"
            >
              ✓ Import to Store
            </Button>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Recent Imports</CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">No imports yet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Product ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">
                      {new Date(log.imported_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs">{log.source}</TableCell>
                    <TableCell className="text-xs font-mono">{log.external_id || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          log.status === "success"
                            ? "bg-green-500 hover:bg-green-600"
                            : "bg-red-500 hover:bg-red-600"
                        }
                      >
                        {log.status === "success" ? "Success" : "Failed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {log.product_id ? (
                        <Link
                          to="/kali_master/products"
                          className="text-xs text-primary hover:underline"
                        >
                          View
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PriceRow({
  label,
  value,
  italic,
  valueClass,
}: {
  label: string;
  value: string;
  italic?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm">{label}</span>
      <span
        className={`text-sm ${italic ? "text-muted-foreground italic" : ""} ${valueClass || ""}`}
      >
        {value}
      </span>
    </div>
  );
}
