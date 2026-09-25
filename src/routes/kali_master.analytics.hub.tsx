import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Activity, DollarSign, Globe, Package } from "lucide-react";
import { SectionHub } from "@/components/admin/SectionHub";

export const Route = createFileRoute("/kali_master/analytics/hub")({
  component: AnalyticsHub,
});

function AnalyticsHub() {
  return (
    <SectionHub
      title="All Analytics"
      subtitle="Store performance, ads ও traffic insights"
      items={[
        {
          label: "Overview",
          href: "/kali_master/analytics",
          description: "All-up KPI snapshot",
          icon: BarChart3,
        },
        {
          label: "Meta Analytics",
          href: "/kali_master/meta-analytics",
          description: "Facebook / Instagram ads performance",
          icon: Activity,
        },
        {
          label: "Sales",
          href: "/kali_master/analytics/sales",
          description: "Revenue ও order trends",
          icon: DollarSign,
        },
        {
          label: "Traffic",
          href: "/kali_master/analytics/traffic",
          description: "Visitor sources ও sessions",
          icon: Globe,
        },
        {
          label: "Products",
          href: "/kali_master/analytics/products",
          description: "Top sellers ও inventory insights",
          icon: Package,
        },
      ]}
    />
  );
}
