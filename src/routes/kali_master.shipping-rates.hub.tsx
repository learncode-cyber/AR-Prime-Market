import { createFileRoute } from "@tanstack/react-router";
import { Truck, MapPin, Building2 } from "lucide-react";
import { SectionHub } from "@/components/admin/SectionHub";

export const Route = createFileRoute("/kali_master/shipping-rates/hub")({
  component: ShippingHub,
});

function ShippingHub() {
  return (
    <SectionHub
      title="All Shipping"
      subtitle="Rates, zones ও carrier partners"
      items={[
        {
          label: "Rates",
          href: "/kali_master/shipping-rates",
          description: "Per-product / per-weight shipping rates",
          icon: Truck,
        },
        {
          label: "Zones",
          href: "/kali_master/shipping-rates/zones",
          description: "Country / region grouping",
          icon: MapPin,
        },
        {
          label: "Carriers",
          href: "/kali_master/shipping-rates/carriers",
          description: "Logistics partner list",
          icon: Building2,
        },
      ]}
    />
  );
}
