import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAgentHistory } from "@/lib/agent-actions.functions";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

function statusBadge(status: string) {
  if (status === "completed")
    return <Badge className="bg-green-600 hover:bg-green-600">সম্পন্ন</Badge>;
  if (status === "rejected") return <Badge variant="destructive">বাতিল</Badge>;
  if (status === "failed") return <Badge variant="destructive">ব্যর্থ</Badge>;
  return <Badge variant="secondary">স্বয়ংক্রিয়</Badge>;
}

export function HistoryPanel() {
  const fetcher = useServerFn(listAgentHistory);
  const { data, isLoading } = useQuery({
    queryKey: ["agent-history"],
    queryFn: () => fetcher(),
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">এখনো কোনো history নেই।</div>
    );
  }
  return (
    <div className="divide-y divide-border">
      {data.map((t) => (
        <div key={t.id} className="p-3 flex items-start justify-between gap-3 hover:bg-accent/30">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{t.title}</div>
            <div className="text-xs text-muted-foreground">
              {t.task_type} · {new Date(t.created_at).toLocaleString("bn-BD")}
            </div>
            {t.result && typeof t.result === "object" && "message" in (t.result as object) && (
              <div className="text-xs mt-1 text-foreground/80">
                {String((t.result as Record<string, unknown>).message ?? "")}
              </div>
            )}
          </div>
          <div className="shrink-0">{statusBadge(t.status)}</div>
        </div>
      ))}
    </div>
  );
}
