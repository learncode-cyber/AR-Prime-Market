import { createFileRoute } from "@tanstack/react-router";
import { Package, KeyRound, Search, Webhook, Activity, Boxes } from "lucide-react";
import { SectionHub } from "@/components/admin/SectionHub";

export const Route = createFileRoute("/kali_master/cj-settings/hub")({
  component: CjSettingsHub,
});

function CjSettingsHub() {
  return (
    <SectionHub
      title="All CJ Settings"
      subtitle="CJ Dropshipping API, import ও realtime sync"
      items={[
        {
          label: "Overview",
          href: "/kali_master/cj-settings",
          description: "Status ও quick stats",
          icon: Package,
        },
        {
          label: "API",
          href: "/kali_master/cj-settings/api",
          description: "API key ও credential config",
          icon: KeyRound,
        },
        {
          label: "Search & Import",
          href: "/kali_master/cj-settings/search",
          description: "Product search ও bulk import",
          icon: Search,
        },
        {
          label: "Imported",
          href: "/kali_master/cj-settings/imported",
          description: "Already imported products",
          icon: Boxes,
        },
        {
          label: "Webhook",
          href: "/kali_master/cj-settings/webhook",
          description: "Realtime sync webhook config",
          icon: Webhook,
        },
        {
          label: "Events",
          href: "/kali_master/cj-settings/events",
          description: "Webhook event log",
          icon: Activity,
        },
      ]}
    />
  );
}
