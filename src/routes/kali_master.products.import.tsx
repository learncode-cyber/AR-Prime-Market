import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Package, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { StockSyncStatus } from "@/lib/products-import-shared";

export const Route = createFileRoute("/kali_master/products/import")({
  component: ImportLayout,
});

const tabs = [
  { to: "/kali_master/products/import/cj", label: "CJ Dropshipping" },
  { to: "/kali_master/products/import/aliexpress", label: "AliExpress" },
  { to: "/kali_master/products/import/spocket", label: "Spocket" },
  { to: "/kali_master/products/import/csv", label: "CSV / URL" },
] as const;

function ImportLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/kali_master/products"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ChevronLeft className="w-3 h-3" /> Back to Products
        </Link>
        <h1 className="text-2xl font-bold mt-2 flex items-center gap-2">
          <Package className="w-6 h-6 text-primary" /> Product Importer
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          1-click import from dropshipping providers, manual URL, or CSV bulk upload.
        </p>
      </div>

      <StockSyncStatus />

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((t) => {
          const active = pathname === t.to || pathname.startsWith(t.to + "/");
          return (
            <Link
              key={t.to}
              to={t.to}
              preload="intent"
              className={cn(
                "px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <Outlet />
    </div>
  );
}
