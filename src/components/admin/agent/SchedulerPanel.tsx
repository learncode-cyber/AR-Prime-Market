import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calendar, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { executeAgentAction } from "@/lib/agent-actions.functions";

export function SchedulerPanel() {
  const execFn = useServerFn(executeAgentAction);
  const [scheduleType, setScheduleType] = useState("create_coupon");
  const [scheduleWhen, setScheduleWhen] = useState(() => {
    const d = new Date(Date.now() + 5 * 60_000);
    return d.toISOString().slice(0, 16);
  });
  const [schedulePayload, setSchedulePayload] = useState(
    JSON.stringify({ code: "FLASH30", discount_type: "percentage", discount_value: 30 }, null, 2),
  );

  const schedule = useMutation({
    mutationFn: () => {
      let inner: Record<string, unknown> = {};
      try {
        inner = JSON.parse(schedulePayload);
      } catch {
        throw new Error("Invalid JSON payload");
      }
      return execFn({
        data: {
          action_type: "schedule_task",
          label: `Schedule ${scheduleType}`,
          reasoning: "Admin manual schedule",
          payload: {
            action_type: scheduleType,
            scheduled_at: new Date(scheduleWhen).toISOString(),
            inner_payload: inner,
            label: `Scheduled ${scheduleType}`,
          },
          decision: "confirm",
        },
      });
    },
    onSuccess: (r) => toast.success(r.result_message),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-4 space-y-3">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Schedule a task
        </h3>
        <p className="text-xs text-muted-foreground">
          Cron runs every minute; tasks fire when their time arrives.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <select
          className="border rounded px-2 py-2 text-sm bg-background"
          value={scheduleType}
          onChange={(e) => setScheduleType(e.target.value)}
        >
          <option value="create_coupon">create_coupon</option>
          <option value="send_marketing_email">send_marketing_email</option>
          <option value="send_push_notification">send_push_notification</option>
          <option value="create_ad_campaign">create_ad_campaign</option>
        </select>
        <Input
          type="datetime-local"
          value={scheduleWhen}
          onChange={(e) => setScheduleWhen(e.target.value)}
        />
      </div>
      <Textarea
        rows={6}
        value={schedulePayload}
        onChange={(e) => setSchedulePayload(e.target.value)}
        className="font-mono text-xs"
      />
      <Button size="sm" onClick={() => schedule.mutate()} disabled={schedule.isPending}>
        {schedule.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
        Queue for scheduled execution
      </Button>
    </Card>
  );
}
