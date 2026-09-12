import { createFileRoute } from "@tanstack/react-router";
import { Search, ListChecks, History, Settings, Webhook } from "lucide-react";
import { SectionHub } from "@/components/admin/SectionHub";

export const Route = createFileRoute("/kali_master/seo-audit/hub")({
  component: SeoAuditHub,
});

function SeoAuditHub() {
  return (
    <SectionHub
      title="All SEO Audit"
      subtitle="Crawl results, history ও configuration"
      items={[
        {
          label: "Overview",
          href: "/kali_master/seo-audit",
          description: "Latest scan summary",
          icon: Search,
        },
        {
          label: "Findings",
          href: "/kali_master/seo-audit/findings",
          description: "Issues ও recommendations",
          icon: ListChecks,
        },
        {
          label: "History",
          href: "/kali_master/seo-audit/history",
          description: "Past scan results",
          icon: History,
        },
        {
          label: "Config",
          href: "/kali_master/seo-audit/config",
          description: "Scan rules ও thresholds",
          icon: Settings,
        },
        {
          label: "Webhook",
          href: "/kali_master/seo-audit/webhook",
          description: "External scan trigger endpoint",
          icon: Webhook,
        },
      ]}
    />
  );
}
