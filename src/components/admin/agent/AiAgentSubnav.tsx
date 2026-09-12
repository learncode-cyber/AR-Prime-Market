import { Link, useRouterState } from "@tanstack/react-router";

const tabs = [
  { to: "/kali_master/ai-agent" as const, label: "Brain" },
  { to: "/kali_master/ai-agent/settings" as const, label: "Settings" },
  { to: "/kali_master/ai-agent/push" as const, label: "Push" },
  { to: "/kali_master/ai-agent/email" as const, label: "Email" },
  { to: "/kali_master/ai-agent/schedule" as const, label: "Schedule" },
  { to: "/kali_master/ai-agent/chat" as const, label: "Chat" },
];

export function AiAgentSubnav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex flex-wrap gap-1 border-b mb-4 pb-1">
      {tabs.map((t) => {
        const active = path === t.to;
        return (
          <Link
            key={t.to}
            to={t.to}
            preload="intent"
            className={`px-3 py-1.5 text-sm rounded-md transition ${
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
