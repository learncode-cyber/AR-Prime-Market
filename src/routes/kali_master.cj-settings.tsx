import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Package, KeyRound, Search, Webhook, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/kali_master/cj-settings")({
  component: CjSettingsLayout,
});

const tabs = [
  { to: "/kali_master/cj-settings/api", label: "API", icon: KeyRound },
  { to: "/kali_master/cj-settings/search", label: "Search & Import", icon: Search },
  { to: "/kali_master/cj-settings/imported", label: "Imported", icon: Package },
  { to: "/kali_master/cj-settings/webhook", label: "Webhook", icon: Webhook },
  { to: "/kali_master/cj-settings/events", label: "Event Log", icon: Activity },
] as const;

function CjSettingsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package className="w-6 h-6 text-primary" /> CJ Dropshipping
        </h1>
        <p className="text-sm text-muted-foreground">API config, product import & realtime sync</p>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((t) => {
          const active = pathname === t.to || pathname.startsWith(t.to + "/");
          return (
            <Link
              key={t.to}
              to={t.to}
              preload="intent"
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </Link>
          );
        })}
      </div>

      <Outlet />
    </div>
  );
}
