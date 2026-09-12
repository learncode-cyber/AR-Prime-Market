import { createFileRoute } from "@tanstack/react-router";
import { AiAgentSubnav } from "@/components/admin/agent/AiAgentSubnav";
import { PushPanel } from "@/components/admin/agent/PushPanel";

export const Route = createFileRoute("/kali_master/ai-agent/push")({
  component: PushPage,
});

function PushPage() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-1">Web Push</h1>
      <p className="text-sm text-muted-foreground mb-4">Admin devices-এ push notifications পাঠান</p>
      <AiAgentSubnav />
      <PushPanel />
    </div>
  );
}
