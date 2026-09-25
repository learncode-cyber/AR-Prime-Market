import { createFileRoute } from "@tanstack/react-router";
import { AiAgentSubnav } from "@/components/admin/agent/AiAgentSubnav";
import { EmailBlastPanel } from "@/components/admin/agent/EmailBlastPanel";

export const Route = createFileRoute("/kali_master/ai-agent/email")({
  component: EmailPage,
});

function EmailPage() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-1">Email Blast</h1>
      <p className="text-sm text-muted-foreground mb-4">Resend দিয়ে সকল customer-কে bulk email</p>
      <AiAgentSubnav />
      <EmailBlastPanel />
    </div>
  );
}
