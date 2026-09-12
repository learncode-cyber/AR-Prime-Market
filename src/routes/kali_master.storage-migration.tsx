import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { HardDrive, CloudUpload, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  getStorageMigrationOverview,
  migrateBucketBatch,
  retryFailedMigrations,
} from "@/lib/storage-migration.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/kali_master/storage-migration")({
  component: StorageMigrationPage,
});

function StorageMigrationPage() {
  const fetchOverview = useServerFn(getStorageMigrationOverview);
  const migrate = useServerFn(migrateBucketBatch);
  const retry = useServerFn(retryFailedMigrations);
  const qc = useQueryClient();
  const [runningBucket, setRunningBucket] = useState<string | null>(null);

  const overview = useQuery({
    queryKey: ["storage-migration", "overview"],
    queryFn: () => fetchOverview(),
    refetchInterval: 10_000,
  });

  const migrateMut = useMutation({
    mutationFn: (bucket: string) => migrate({ data: { bucket: bucket as any, limit: 50 } }),
    onMutate: (b) => setRunningBucket(b),
    onSuccess: (res) => {
      toast.success(
        `${res.bucket}: ${res.migrated} migrated, ${res.skipped} skipped, ${res.failed} failed`,
      );
      qc.invalidateQueries({ queryKey: ["storage-migration"] });
    },
    onError: (e: any) => toast.error(e?.message || "Migration failed"),
    onSettled: () => setRunningBucket(null),
  });

  const retryMut = useMutation({
    mutationFn: () => retry(),
    onSuccess: (r) => {
      toast.success(`${r.retried} failed logs marked for retry. Re-run the bucket(s).`);
      qc.invalidateQueries({ queryKey: ["storage-migration"] });
    },
    onError: (e: any) => toast.error(e?.message || "Retry failed"),
  });

  const buckets = overview.data?.buckets ?? [];
  const logs = overview.data?.logs ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <CloudUpload className="w-6 h-6 text-primary" />
            Cloudflare R2 Migration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Move existing Supabase Storage files to R2 with verification. New uploads already prefer
            R2; Supabase is kept only as a fallback.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => overview.refetch()}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" onClick={() => retryMut.mutate()} disabled={retryMut.isPending}>
            <AlertTriangle className="w-4 h-4 mr-1" /> Reset failed
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {buckets.map((b) => (
          <Card key={b.bucket} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <HardDrive className="w-4 h-4 text-muted-foreground" />
                {b.bucket}
              </div>
              <Badge variant="secondary">{b.objectCount} objects</Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="w-3.5 h-3.5" /> {b.migrated}
              </span>
              <span className="flex items-center gap-1 text-destructive">
                <AlertTriangle className="w-3.5 h-3.5" /> {b.failed}
              </span>
            </div>
            <Button
              size="sm"
              className="w-full"
              onClick={() => migrateMut.mutate(b.bucket)}
              disabled={b.objectCount === 0 || migrateMut.isPending || runningBucket === b.bucket}
            >
              {b.objectCount === 0
                ? "No files to migrate"
                : runningBucket === b.bucket
                  ? "Migrating…"
                  : "Migrate next 50"}
            </Button>
          </Card>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-border/50 font-medium">Recent activity</div>
        <div className="max-h-[480px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Bucket</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No activity yet. Run a migration to populate logs.
                  </TableCell>
                </TableRow>
              )}
              {logs.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(l.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs">{l.bucket ?? "—"}</TableCell>
                  <TableCell className="text-xs max-w-[240px] truncate" title={l.source_path}>
                    {l.source_path ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        l.status === "success"
                          ? "default"
                          : l.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {l.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{l.attempts ?? 0}</TableCell>
                  <TableCell
                    className="text-xs text-destructive max-w-[280px] truncate"
                    title={l.error_message ?? ""}
                  >
                    {l.error_message ?? ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
