import { createFileRoute } from "@tanstack/react-router";
import { Rocket, Brain, Target, Search, Users } from "lucide-react";
import { SectionHub } from "@/components/admin/SectionHub";

export const Route = createFileRoute("/kali_master/marketing-ai-hub/hub")({
  component: MarketingHub,
});

function MarketingHub() {
  return (
    <SectionHub
      title="All Marketing"
      subtitle="Campaigns, pixels, SEO ও social proof"
      items={[
        {
          label: "Overview",
          href: "/kali_master/marketing-ai-hub",
          description: "Marketing dashboard ও snapshots",
          icon: Rocket,
        },
        {
          label: "Architect",
          href: "/kali_master/marketing-ai-hub/architect",
          description: "AI campaign builder",
          icon: Brain,
        },
        {
          label: "Pixels",
          href: "/kali_master/marketing-ai-hub/pixels",
          description: "Meta, GA, TikTok tracking pixels",
          icon: Target,
        },
        {
          label: "SEO",
          href: "/kali_master/marketing-ai-hub/seo",
          description: "SEO settings ও optimizations",
          icon: Search,
        },
        {
          label: "Fake Orders",
          href: "/kali_master/fake-orders",
          description: "Social proof order popups",
          icon: Users,
        },
      ]}
    />
  );
}
