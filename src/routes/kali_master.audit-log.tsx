import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useMemo, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ShieldAlert,
  RotateCw,
  FileSpreadsheet,
  FileText,
  FileType2,
  Download,
  Save,
  Trash2,
  BookmarkPlus,
} from "lucide-react";
import { listSensitiveAccessLogs } from "@/lib/audit-log.functions";
import {
  listExportPresets,
  saveExportPreset,
  deleteExportPreset,
  PRESET_COLUMNS,
  type PresetColumn,
} from "@/lib/audit-log-presets.functions";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Document,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  Packer,
  HeadingLevel,
  AlignmentType,
  WidthType,
  TextRun,
} from "docx";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/kali_master/audit-log")({
  component: AuditLogPage,
  head: () => ({
    meta: [
      { title: "Sensitive Access Audit — AR Prime Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type LogRow = {
  id: string;
  user_id: string;
  table_name: string;
  fields: string[];
  record_ids: string[];
  context: string | null;
  row_count: number;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user_email: string | null;
  user_name: string | null;
};

const COLUMN_META: Record<PresetColumn, { header: string; get: (l: LogRow) => string }> = {
  created_at: { header: "Timestamp", get: (l) => new Date(l.created_at).toLocaleString() },
  user_name: { header: "User Name", get: (l) => l.user_name || "" },
  user_email: { header: "User Email", get: (l) => l.user_email || "" },
  user_id: { header: "User ID", get: (l) => l.user_id },
  table_name: { header: "Table", get: (l) => l.table_name },
  fields: { header: "Fields", get: (l) => l.fields.join(", ") },
  record_ids: { header: "Record IDs", get: (l) => (l.record_ids ?? []).join(", ") },
  row_count: { header: "Rows", get: (l) => String(l.row_count) },
  context: { header: "Context", get: (l) => l.context || "" },
  ip_address: { header: "IP Address", get: (l) => l.ip_address || "" },
  user_agent: { header: "User Agent", get: (l) => l.user_agent || "" },
};

const DEFAULT_COLUMNS: PresetColumn[] = [
  "created_at",
  "user_name",
  "user_email",
  "table_name",
  "fields",
  "row_count",
  "context",
  "ip_address",
];

function AuditLogPage() {
  const fn = useServerFn(listSensitiveAccessLogs);
  const listPresetsFn = useServerFn(listExportPresets);
  const savePresetFn = useServerFn(saveExportPreset);
  const deletePresetFn = useServerFn(deleteExportPreset);
  const qc = useQueryClient();

  const [tableFilter, setTableFilter] = useState<string>("");
  const [limit, setLimit] = useState(100);
  const [selectedColumns, setSelectedColumns] = useState<PresetColumn[]>(DEFAULT_COLUMNS);
  const [presetName, setPresetName] = useState("");
  const [activePresetId, setActivePresetId] = useState<string>("");

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["sensitive-access-logs", tableFilter, limit],
    queryFn: () =>
      fn({
        data: {
          limit,
          ...(tableFilter ? { table_name: tableFilter } : {}),
        },
      }),
  });

  const logs = (data?.logs ?? []) as LogRow[];

  const presetsQuery = useQuery({
    queryKey: ["audit-log-export-presets"],
    queryFn: () => listPresetsFn({ data: undefined }),
  });
  const presets = (presetsQuery.data?.presets ?? []) as Array<{
    id: string;
    name: string;
    filters: { table_name?: string | null; limit?: number };
    columns: PresetColumn[];
  }>;

  const orderedColumns = useMemo(
    () => PRESET_COLUMNS.filter((c) => selectedColumns.includes(c)) as PresetColumn[],
    [selectedColumns],
  );

  const toggleColumn = (col: PresetColumn) => {
    setSelectedColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
    setActivePresetId("");
  };

  const applyPreset = (id: string) => {
    setActivePresetId(id);
    if (!id) return;
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setTableFilter(p.filters?.table_name || "");
    if (p.filters?.limit) setLimit(p.filters.limit);
    setSelectedColumns(p.columns.length ? p.columns : DEFAULT_COLUMNS);
    setPresetName(p.name);
    toast.success(`Applied preset “${p.name}”`);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!presetName.trim()) throw new Error("Preset name required");
      if (orderedColumns.length === 0) throw new Error("Select at least one column");
      return savePresetFn({
        data: {
          name: presetName.trim(),
          filters: { table_name: tableFilter || null, limit },
          columns: orderedColumns,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(`Saved preset “${res.preset.name}”`);
      setActivePresetId(res.preset.id);
      qc.invalidateQueries({ queryKey: ["audit-log-export-presets"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deletePresetFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Preset deleted");
      setActivePresetId("");
      setPresetName("");
      qc.invalidateQueries({ queryKey: ["audit-log-export-presets"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  // Clear active preset when user manually changes filters
  useEffect(() => {
    setActivePresetId((cur) => {
      if (!cur) return cur;
      const p = presets.find((x) => x.id === cur);
      if (!p) return "";
      const sameTable = (p.filters?.table_name || "") === tableFilter;
      const sameLimit = (p.filters?.limit ?? 100) === limit;
      return sameTable && sameLimit ? cur : "";
    });
  }, [tableFilter, limit, presets]);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportCSV = useCallback(
    (rows: LogRow[], suffix = "") => {
      const cols = orderedColumns;
      const headers = cols.map((c) => COLUMN_META[c].header);
      const body = rows.map((log) => cols.map((c) => COLUMN_META[c].get(log)));
      const csvContent = [headers, ...body]
        .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      downloadBlob(blob, `audit-log${suffix}-${new Date().toISOString().slice(0, 10)}.csv`);
    },
    [orderedColumns],
  );

  const exportPDF = useCallback(
    (rows: LogRow[], suffix = "") => {
      const cols = orderedColumns;
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(16);
      doc.text("Sensitive Field Access Audit Log", 14, 20);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
      doc.text(`Rows: ${rows.length}${tableFilter ? ` · table = ${tableFilter}` : ""}`, 14, 34);

      autoTable(doc, {
        startY: 38,
        head: [cols.map((c) => COLUMN_META[c].header)],
        body: rows.map((log) => cols.map((c) => COLUMN_META[c].get(log) || "—")),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });

      doc.save(`audit-log${suffix}-${new Date().toISOString().slice(0, 10)}.pdf`);
    },
    [orderedColumns, tableFilter],
  );

  const exportDOCX = useCallback(
    async (rows: LogRow[], suffix = "") => {
      const cols = orderedColumns;
      const tableRows = [
        new TableRow({
          children: cols.map(
            (c) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: COLUMN_META[c].header, bold: true })],
                  }),
                ],
              }),
          ),
        }),
        ...rows.map(
          (log) =>
            new TableRow({
              children: cols.map(
                (c) => new TableCell({ children: [new Paragraph(COLUMN_META[c].get(log) || "—")] }),
              ),
            }),
        ),
      ];

      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({
                text: "Sensitive Field Access Audit Log",
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                text: `Generated: ${new Date().toLocaleString()}`,
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                text: `Rows: ${rows.length}${tableFilter ? ` · table = ${tableFilter}` : ""}`,
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph(""),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: tableRows,
              }),
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      downloadBlob(blob, `audit-log${suffix}-${new Date().toISOString().slice(0, 10)}.docx`);
    },
    [orderedColumns, tableFilter],
  );

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [exporting, setExporting] = useState<null | "csv" | "pdf" | "docx">(null);

  const handleExportAll = useCallback(
    async (format: "csv" | "pdf" | "docx") => {
      setExporting(format);
      try {
        const res = await fn({
          data: {
            limit: 50000,
            ...(tableFilter ? { table_name: tableFilter } : {}),
          },
        });
        const allLogs = (res?.logs ?? []) as LogRow[];
        if (format === "csv") exportCSV(allLogs, "-all");
        else if (format === "pdf") exportPDF(allLogs, "-all");
        else await exportDOCX(allLogs, "-all");
        toast.success(`Exported ${allLogs.length} rows as ${format.toUpperCase()}`);
        setConfirmOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Export failed");
      } finally {
        setExporting(null);
      }
    },
    [fn, tableFilter, exportCSV, exportPDF, exportDOCX],
  );

  const noColumns = orderedColumns.length === 0;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-primary" /> Sensitive Field Access Audit
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Records every time an admin or signed-in tool reads cost (<code>cogs</code>) or supplier
            fields on products, variants, or order items.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => exportCSV(logs)}
            disabled={logs.length === 0 || noColumns}
            title="Export CSV (current view)"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" /> CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => exportPDF(logs)}
            disabled={logs.length === 0 || noColumns}
            title="Export PDF (current view)"
          >
            <FileType2 className="w-4 h-4 mr-2" /> PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => exportDOCX(logs)}
            disabled={logs.length === 0 || noColumns}
            title="Export DOCX (current view)"
          >
            <FileText className="w-4 h-4 mr-2" /> DOCX
          </Button>
          <Button
            variant="default"
            onClick={() => setConfirmOpen(true)}
            disabled={noColumns}
            title="Export all rows matching current filters"
          >
            <Download className="w-4 h-4 mr-2" /> Export all matching
          </Button>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RotateCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Export all matching rows?</AlertDialogTitle>
            <AlertDialogDescription>
              This will fetch every audit-log row matching your current filter
              {tableFilter ? ` (table = ${tableFilter})` : " (no table filter)"} — bypassing the
              on-screen row limit of {limit}. Up to 50,000 rows. Output will include{" "}
              {orderedColumns.length} selected column{orderedColumns.length === 1 ? "" : "s"}. Large
              exports may take a few seconds. Pick a format below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-wrap gap-2">
            <AlertDialogCancel disabled={exporting !== null}>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              disabled={exporting !== null}
              onClick={() => handleExportAll("csv")}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              {exporting === "csv" ? "Exporting…" : "CSV"}
            </Button>
            <Button
              variant="outline"
              disabled={exporting !== null}
              onClick={() => handleExportAll("pdf")}
            >
              <FileType2 className="w-4 h-4 mr-2" />
              {exporting === "pdf" ? "Exporting…" : "PDF"}
            </Button>
            <Button
              variant="outline"
              disabled={exporting !== null}
              onClick={() => handleExportAll("docx")}
            >
              <FileText className="w-4 h-4 mr-2" />
              {exporting === "docx" ? "Exporting…" : "DOCX"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="p-4 flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Filter by table</Label>
          <select
            className="border rounded-md px-2 py-1 text-sm bg-background"
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="products">products</option>
            <option value="product_variants">product_variants</option>
            <option value="order_items">order_items</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Limit</Label>
          <Input
            type="number"
            min={1}
            max={200}
            value={limit}
            onChange={(e) => setLimit(Math.max(1, Math.min(200, Number(e.target.value) || 100)))}
            className="w-24"
          />
        </div>
        <div className="text-xs text-muted-foreground ml-auto">{logs.length} entries</div>
      </Card>

      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BookmarkPlus className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Export presets</h2>
            <span className="text-xs text-muted-foreground">
              Save current filters + column selection for one-click reuse.
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Load preset</Label>
            <select
              className="border rounded-md px-2 py-1 text-sm bg-background min-w-[200px]"
              value={activePresetId}
              onChange={(e) => applyPreset(e.target.value)}
              disabled={presetsQuery.isLoading}
            >
              <option value="">— Select a preset —</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Preset name</Label>
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="e.g. Weekly COGS audit"
              className="w-56"
              maxLength={80}
            />
          </div>

          <Button
            variant="default"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !presetName.trim() || noColumns}
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Saving…" : "Save preset"}
          </Button>

          {activePresetId && (
            <Button
              variant="outline"
              onClick={() => deleteMutation.mutate(activePresetId)}
              disabled={deleteMutation.isPending}
              title="Delete selected preset"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Columns included in exports</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {PRESET_COLUMNS.map((col) => (
              <label key={col} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={selectedColumns.includes(col)}
                  onCheckedChange={() => toggleColumn(col)}
                />
                <span>{COLUMN_META[col].header}</span>
              </label>
            ))}
          </div>
          {noColumns && (
            <p className="text-xs text-destructive">
              Select at least one column to enable exports.
            </p>
          )}
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">When</th>
                <th className="text-left p-3">User</th>
                <th className="text-left p-3">Table</th>
                <th className="text-left p-3">Fields</th>
                <th className="text-left p-3">Rows</th>
                <th className="text-left p-3">Context</th>
                <th className="text-left p-3">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/30">
                  <td className="p-3 whitespace-nowrap text-xs">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{log.user_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {log.user_email || log.user_id}
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline">{log.table_name}</Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {log.fields.map((f) => (
                        <Badge key={f} variant="secondary" className="text-[10px]">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 tabular-nums">{log.row_count}</td>
                  <td className="p-3 text-xs text-muted-foreground max-w-xs truncate">
                    {log.context || "—"}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{log.ip_address || "—"}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground text-sm">
                    No access recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
