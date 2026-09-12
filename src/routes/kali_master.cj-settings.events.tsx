import { createFileRoute } from "@tanstack/react-router";
import { AdminPending, AdminErrorComponent, AdminNotFound } from "@/lib/admin-route-boundaries";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Trash2, Loader2, Activity, ChevronDown, ChevronRight } from "lucide-react";
import type { WebhookEvent } from "@/lib/cj-settings-shared";

export const Route = createFileRoute("/kali_master/cj-settings/events")({
  pendingComponent: () => <AdminPending />,
  errorComponent: AdminErrorComponent,
  notFoundComponent: AdminNotFound,
  component: CjEventsSection,
});

function CjEventsSection() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  useEffect(() => {
    loadEvents();
    const ev = supabase
      .channel("cj-webhook-events-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "cj_webhook_events" }, () =>
        loadEvents(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ev);
    };
  }, []);

  async function loadEvents() {
    setLoadingEvents(true);
    const { data, error } = await supabase
      .from("cj_webhook_events")
      .select("id, event_type, cj_pid, payload, status, error_message, processed_at, received_at")
      .order("received_at", { ascending: false })
      .limit(100);
    if (error) toast.error(error.message);
    else setEvents((data || []) as WebhookEvent[]);
    setLoadingEvents(false);
  }

  async function clearEvents() {
    if (!confirm("Delete ALL webhook event logs?")) return;
    const { error } = await supabase
      .from("cj_webhook_events")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) return toast.error(error.message);
    toast.success("Cleared");
    loadEvents();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-4 h-4" /> Webhook Event Log
        </CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "STOCK", "PRODUCT", "VARIANT"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={eventFilter === f ? "default" : "outline"}
              onClick={() => setEventFilter(f)}
            >
              {f === "all" ? "All" : f}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={loadEvents} aria-label="Refresh events">
            <RefreshCw className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={clearEvents}
            disabled={!events.length}
            aria-label="Clear events"
          >
            <Trash2 className="w-3 h-3 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loadingEvents ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : !events.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No webhook events received yet. Once CJ sends a callback, it will appear here.
          </p>
        ) : (
          <div className="space-y-2">
            {events
              .filter((e) => eventFilter === "all" || e.event_type === eventFilter)
              .map((e) => {
                const expanded = expandedEvent === e.id;
                const statusColor =
                  e.status === "processed"
                    ? "bg-emerald-600 hover:bg-emerald-600"
                    : e.status === "error"
                      ? "bg-destructive hover:bg-destructive"
                      : e.status === "ignored" || e.status === "skipped"
                        ? "bg-amber-600 hover:bg-amber-600"
                        : "bg-secondary hover:bg-secondary";
                return (
                  <div key={e.id} className="border border-border rounded-md bg-card">
                    <button
                      type="button"
                      onClick={() => setExpandedEvent(expanded ? null : e.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-secondary/40 transition-colors"
                    >
                      {expanded ? (
                        <ChevronDown className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 flex-shrink-0" />
                      )}
                      <Badge variant="outline" className="font-mono text-xs">
                        {e.event_type}
                      </Badge>
                      <Badge className={`${statusColor} text-xs`}>{e.status}</Badge>
                      <span className="text-xs text-muted-foreground font-mono truncate">
                        PID: {e.cj_pid || "—"}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                        {new Date(e.received_at).toLocaleString()}
                      </span>
                    </button>
                    {expanded && (
                      <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/50">
                        {e.error_message && (
                          <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
                            <span className="font-medium">Error:</span> {e.error_message}
                          </div>
                        )}
                        {e.processed_at && (
                          <div className="text-xs text-muted-foreground">
                            Processed: {new Date(e.processed_at).toLocaleString()}
                          </div>
                        )}
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Payload</div>
                          <pre className="text-xs bg-secondary/40 rounded p-2 overflow-x-auto max-h-64 font-mono">
                            {JSON.stringify(e.payload, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
