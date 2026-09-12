import { createFileRoute } from "@tanstack/react-router";
import { Package, Download, Globe, FileText, Boxes } from "lucide-react";
import { SectionHub } from "@/components/admin/SectionHub";

export const Route = createFileRoute("/kali_master/products/hub")({
  component: ProductsHub,
});

function ProductsHub() {
  return (
    <SectionHub
      title="All Products"
      subtitle="Catalog, importer ও sourcing-এর সব pages এক জায়গায়"
      items={[
        {
          label: "All Products",
          href: "/kali_master/products",
          description: "Full catalog browser, edit ও delete",
          icon: Boxes,
        },
        {
          label: "Import Hub",
          href: "/kali_master/products/import",
          description: "Importer overview ও tabs",
          icon: Download,
        },
        {
          label: "AliExpress Import",
          href: "/kali_master/products/import/aliexpress",
          description: "AliExpress URL/keyword search",
          icon: Globe,
        },
        {
          label: "CJ Import",
          href: "/kali_master/products/import/cj",
          description: "CJ Dropshipping 1-click import",
          icon: Package,
        },
        {
          label: "CSV Import",
          href: "/kali_master/products/import/csv",
          description: "Bulk CSV / URL upload",
          icon: FileText,
        },
      ]}
    />
  );
}
