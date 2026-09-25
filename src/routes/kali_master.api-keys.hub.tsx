import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, Plus } from "lucide-react";
import { SectionHub } from "@/components/admin/SectionHub";

export const Route = createFileRoute("/kali_master/api-keys/hub")({
  component: ApiKeysHub,
});

function ApiKeysHub() {
  return (
    <SectionHub
      title="All API Keys"
      subtitle="External integration keys manage করুন এক জায়গা থেকে"
      items={[
        {
          label: "All Keys",
          href: "/kali_master/api-keys",
          description: "সব saved API keys browse করুন",
          icon: KeyRound,
        },
        {
          label: "New Key",
          href: "/kali_master/api-keys/new",
          description: "নতুন API key add করুন",
          icon: Plus,
        },
      ]}
    />
  );
}
