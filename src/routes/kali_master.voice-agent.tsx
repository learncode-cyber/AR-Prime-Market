import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Phone, PhoneCall, PhoneOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getVoiceSettings,
  updateVoiceSettings,
  listVoiceCallLogs,
  listVoiceQueue,
  simulateKeypress,
} from "@/lib/voice-agent.functions";

import {
  EditModeProvider,
  EditModeToggle,
  EditModeFieldset,
  useEditMode,
} from "@/components/admin/EditModeShell";

export const Route = createFileRoute("/kali_master/voice-agent")({
  component: () => (
    <EditModeProvider>
      <VoiceAgentPage />
    </EditModeProvider>
  ),
});

function VoiceAgentPage() {
  const { lock } = useEditMode();
  const getSettings = useServerFn(getVoiceSettings);
  const updateSettings = useServerFn(updateVoiceSettings);
  const listLogs = useServerFn(listVoiceCallLogs);
  const listQueue = useServerFn(listVoiceQueue);
  const simulate = useServerFn(simulateKeypress);
  const qc = useQueryClient();

  const settingsQ = useQuery({ queryKey: ["voice-settings"], queryFn: () => getSettings() });
  const logsQ = useQuery({
    queryKey: ["voice-logs"],
    queryFn: () => listLogs(),
    refetchInterval: 5000,
  });
  const queueQ = useQuery({
    queryKey: ["voice-queue"],
    queryFn: () => listQueue(),
    refetchInterval: 5000,
  });

  const [delay, setDelay] = useState(90);
  const [template, setTemplate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settingsQ.data?.settings) {
      setDelay(settingsQ.data.settings.delay_seconds);
      setTemplate(settingsQ.data.settings.script_template);
    }
  }, [settingsQ.data]);

  const enabled = settingsQ.data?.settings?.enabled ?? false;

  const toggle = async (next: boolean) => {
    await updateSettings({ data: { enabled: next } });
    qc.invalidateQueries({ queryKey: ["voice-settings"] });
    toast.success(next ? "Voice Agent ON" : "Voice Agent OFF");
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateSettings({ data: { delay_seconds: delay, script_template: template } });
      qc.invalidateQueries({ queryKey: ["voice-settings"] });
      toast.success("Saved");
      lock();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const press = async (call_log_id: string, digit: "1" | "2") => {
    try {
      await simulate({ data: { call_log_id, digit } });
      qc.invalidateQueries({ queryKey: ["voice-logs"] });
      toast.success(`Simulated keypress ${digit}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PhoneCall className="w-6 h-6 text-primary" />
            AI Voice Call Agent
          </h1>
          <p className="text-sm text-muted-foreground">
            Order confirmation calls (Bengali, mock mode). Default OFF — toggle ON to start
            dispatching.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={enabled ? "default" : "secondary"} className="text-sm">
            {enabled ? "● LIVE" : "○ OFF"}
          </Badge>
          <EditModeToggle />
        </div>
      </div>

      <Card className="p-4 space-y-4">
        <EditModeFieldset>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">Auto-call on new orders</div>
                <div className="text-xs text-muted-foreground">
                  Trigger a confirmation call {delay}s after every order is placed.
                </div>
              </div>
              <Switch checked={enabled} onCheckedChange={toggle} disabled={settingsQ.isLoading} />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-sm">
                <div className="mb-1 text-muted-foreground">Delay (seconds)</div>
                <Input
                  type="number"
                  min={0}
                  max={3600}
                  value={delay}
                  onChange={(e) => setDelay(parseInt(e.target.value || "0", 10))}
                />
              </label>
            </div>

            <label className="block text-sm">
              <div className="mb-1 text-muted-foreground">
                Script template — variables: <code>{"{{customer_name}}"}</code>,{" "}
                <code>{"{{total_price}}"}</code>
              </div>
              <Textarea rows={4} value={template} onChange={(e) => setTemplate(e.target.value)} />
            </label>

            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              সেভ করুন
            </Button>
          </div>
        </EditModeFieldset>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Pending queue ({queueQ.data?.queue.length ?? 0})</h2>
        <div className="space-y-1 text-xs font-mono max-h-48 overflow-auto">
          {(queueQ.data?.queue ?? []).map((q) => (
            <div
              key={q.id}
              className="flex items-center justify-between border-b border-border py-1"
            >
              <span className="truncate">
                {q.order_id.slice(0, 8)} · {new Date(q.scheduled_at).toLocaleString()}
              </span>
              <Badge variant="outline">{q.status}</Badge>
            </div>
          ))}
          {(queueQ.data?.queue ?? []).length === 0 && (
            <div className="text-muted-foreground">No queued calls.</div>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Phone className="w-4 h-4" />
          Recent call logs
        </h2>
        <div className="space-y-2">
          {(logsQ.data?.logs ?? []).map((log) => (
            <div key={log.id} className="border border-border rounded p-3 text-sm space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="font-mono text-xs">
                  {log.customer_name || "—"} · {log.phone || "no phone"} · order{" "}
                  {log.order_id.slice(0, 8)}
                </div>
                <Badge
                  variant={
                    log.status === "confirmed"
                      ? "default"
                      : log.status === "cancelled"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {log.status}
                  {log.dtmf_digit ? ` (${log.dtmf_digit})` : ""}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground whitespace-pre-wrap">{log.script}</div>
              {log.status === "ringing" && (
                <div className="flex gap-2">
                  <Button size="sm" variant="default" onClick={() => press(log.id, "1")}>
                    <PhoneCall className="w-3 h-3 mr-1" /> Press 1 (Confirm)
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => press(log.id, "2")}>
                    <PhoneOff className="w-3 h-3 mr-1" /> Press 2 (Cancel)
                  </Button>
                </div>
              )}
              <div className="text-[10px] text-muted-foreground">
                {new Date(log.created_at).toLocaleString()} · {log.provider}
              </div>
            </div>
          ))}
          {(logsQ.data?.logs ?? []).length === 0 && (
            <div className="text-sm text-muted-foreground">No calls yet.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
