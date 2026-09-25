import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/health")({
  head: () => ({
    meta: [
      { title: "Health Check — AR Prime Market" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Application health and deployment status." },
    ],
  }),
  component: HealthPage,
});

function HealthPage() {
  const [hydrated, setHydrated] = useState(false);
  const [ts, setTs] = useState<string>("");
  const [ua, setUa] = useState<string>("");
  const [origin, setOrigin] = useState<string>("");
  const [loadMs, setLoadMs] = useState<number | null>(null);

  useEffect(() => {
    setHydrated(true);
    setTs(new Date().toISOString());
    setUa(navigator.userAgent);
    setOrigin(window.location.origin);
    try {
      const nav = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (nav) setLoadMs(Math.round(nav.domContentLoadedEventEnd));
    } catch {}
  }, []);

  const Row = ({
    label,
    value,
    ok = true,
  }: {
    label: string;
    value: string | number | null;
    ok?: boolean;
  }) => (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`text-sm font-mono text-right break-all ${ok ? "text-foreground" : "text-destructive"}`}
      >
        {value ?? "—"}
      </span>
    </div>
  );

  return (
    <div className="min-h-[60vh] max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-6">
        <div
          className={`w-3 h-3 rounded-full ${hydrated ? "bg-emerald-500" : "bg-amber-500"} animate-pulse`}
        />
        <h1 className="text-2xl font-bold">{hydrated ? "App is live" : "Booting…"}</h1>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <Row label="SSR shell rendered" value="yes" />
        <Row label="React hydrated" value={hydrated ? "yes" : "no"} ok={hydrated} />
        <Row label="Router mounted" value="yes" />
        <Row label="Origin" value={origin} />
        <Row label="Timestamp" value={ts} />
        <Row label="DOMContentLoaded" value={loadMs !== null ? `${loadMs} ms` : "measuring…"} />
        <Row label="User agent" value={ua} />
      </div>
      <p className="text-xs text-muted-foreground mt-4">
        যদি এই পেজে সবুজ dot এবং "App is live" দেখা যায় — ডেপ্লয় ঠিক আছে এবং কনটেন্ট রেন্ডার
        হচ্ছে।
      </p>
    </div>
  );
}
