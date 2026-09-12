import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Rocket, Megaphone, Gauge, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/kali_master/marketing-ai-hub")({
  component: MarketingAIHubLayout,
});

const tabs = [
  { to: "/kali_master/marketing-ai-hub/pixels", label: "Pixels & Tracking", icon: Megaphone },
  { to: "/kali_master/marketing-ai-hub/seo", label: "SEO & Blog AI", icon: Gauge },
  { to: "/kali_master/marketing-ai-hub/architect", label: "Claude Architect", icon: Sparkles },
] as const;

function MarketingAIHubLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
          <Rocket className="w-6 h-6 text-primary" />
          Marketing & AI Hub
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enterprise marketing suite — pixels, SEO command center, automated blog engine and the
          Claude live UI editor in one place.
        </p>
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
