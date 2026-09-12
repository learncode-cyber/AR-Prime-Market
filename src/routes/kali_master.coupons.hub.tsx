import { createFileRoute } from "@tanstack/react-router";
import { Ticket, Plus, BarChart3 } from "lucide-react";
import { SectionHub } from "@/components/admin/SectionHub";

export const Route = createFileRoute("/kali_master/coupons/hub")({
  component: CouponsHub,
});

function CouponsHub() {
  return (
    <SectionHub
      title="All Coupons"
      subtitle="Discount codes, creation ও usage insights"
      items={[
        {
          label: "All Coupons",
          href: "/kali_master/coupons",
          description: "Active ও expired coupons-এর list",
          icon: Ticket,
        },
        {
          label: "Create Coupon",
          href: "/kali_master/coupons/create",
          description: "নতুন discount code বানান",
          icon: Plus,
        },
        {
          label: "Analytics",
          href: "/kali_master/coupons/analytics",
          description: "Coupon redemption ও revenue impact",
          icon: BarChart3,
        },
      ]}
    />
  );
}
