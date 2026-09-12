import { createFileRoute } from "@tanstack/react-router";
import { AiAgentSubnav } from "@/components/admin/agent/AiAgentSubnav";
import { SchedulerPanel } from "@/components/admin/agent/SchedulerPanel";

export const Route = createFileRoute("/kali_master/ai-agent/schedule")({
  component: SchedulePage,
});

function SchedulePage() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-1">Schedule Tasks</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Cron-based scheduled marketing tasks (runs every minute)
      </p>
      <AiAgentSubnav />
      <SchedulerPanel />
    </div>
  );
}
