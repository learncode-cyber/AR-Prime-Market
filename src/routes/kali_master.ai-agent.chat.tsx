import { createFileRoute } from "@tanstack/react-router";
import { AiAgentSubnav } from "@/components/admin/agent/AiAgentSubnav";
import { AgentChat } from "@/components/admin/agent/AgentChat";

export const Route = createFileRoute("/kali_master/ai-agent/chat")({
  component: ChatPage,
});

function ChatPage() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-1">Agent Chat</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Marketing Agent-এর সাথে directly conversation
      </p>
      <AiAgentSubnav />
      <AgentChat />
    </div>
  );
}
