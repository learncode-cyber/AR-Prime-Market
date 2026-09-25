import { createFileRoute } from "@tanstack/react-router";
import { Bot, Bell, Mail, Clock, MessageSquare } from "lucide-react";
import { SectionHub } from "@/components/admin/SectionHub";

export const Route = createFileRoute("/kali_master/ai-agent/hub")({
  component: AiAgentHub,
});

function AiAgentHub() {
  return (
    <SectionHub
      title="All AI Agent"
      subtitle="Marketing brain, communication ও automation"
      items={[
        {
          label: "Brain",
          href: "/kali_master/ai-agent",
          description: "Agent configuration ও training",
          icon: Bot,
        },
        {
          label: "Web Push",
          href: "/kali_master/ai-agent/push",
          description: "Browser push notifications",
          icon: Bell,
        },
        {
          label: "Email Blast",
          href: "/kali_master/ai-agent/email",
          description: "Bulk customer emails via Resend",
          icon: Mail,
        },
        {
          label: "Schedule",
          href: "/kali_master/ai-agent/schedule",
          description: "Cron-based scheduled tasks",
          icon: Clock,
        },
        {
          label: "Chat",
          href: "/kali_master/ai-agent/chat",
          description: "Direct conversation with the agent",
          icon: MessageSquare,
        },
      ]}
    />
  );
}
