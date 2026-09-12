import { createFileRoute } from "@tanstack/react-router";
import { Factory, Package, Globe } from "lucide-react";
import { SectionHub } from "@/components/admin/SectionHub";

export const Route = createFileRoute("/kali_master/suppliers/hub")({
  component: SuppliersHub,
});

function SuppliersHub() {
  return (
    <SectionHub
      title="All Suppliers"
      subtitle="Dropshipping ও wholesale partners"
      items={[
        {
          label: "All Suppliers",
          href: "/kali_master/suppliers",
          description: "সব connected suppliers",
          icon: Factory,
        },
        {
          label: "CJ Dropshipping",
          href: "/kali_master/suppliers/cj",
          description: "CJ integration shortcut",
          icon: Package,
        },
        {
          label: "AliExpress",
          href: "/kali_master/suppliers/aliexpress",
          description: "AliExpress integration shortcut",
          icon: Globe,
        },
      ]}
    />
  );
}
