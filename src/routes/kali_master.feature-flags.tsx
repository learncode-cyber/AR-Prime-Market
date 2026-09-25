import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, Search, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import {
  getFeatureFlags,
  updateFeatureFlag,
  bulkUpdateFeatureFlags,
  type FeatureFlag,
} from "@/lib/feature-flags.functions";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/kali_master/feature-flags")({
  component: FeatureFlagsPage,
});

const CATEGORY_LABELS: Record<string, string> = {
  commerce: "Commerce",
  content: "Content",
  account: "Account & Auth",
  marketing: "Marketing",
  ai: "AI & Automation",
  integrations: "Integrations",
  other: "Other",
};

function FeatureFlagsPage() {
  const fetchFlags = useServerFn(getFeatureFlags);
  const updateFlag = useServerFn(updateFeatureFlag);
  const bulkUpdate = useServerFn(bulkUpdateFeatureFlags);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-feature-flags"],
    queryFn: () => fetchFlags(),
  });

  const grouped = useMemo(() => {
    const flags: FeatureFlag[] = data?.flags ?? [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? flags.filter(
          (f) =>
            f.key.toLowerCase().includes(q) ||
            f.label.toLowerCase().includes(q) ||
            (f.description ?? "").toLowerCase().includes(q),
        )
      : flags;
    const map = new Map<string, FeatureFlag[]>();
    for (const f of filtered) {
      const arr = map.get(f.category) ?? [];
      arr.push(f);
      map.set(f.category, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [data, search]);

  const handleToggle = async (flag: FeatureFlag, next: boolean) => {
    setSavingKey(flag.key);
    try {
      await updateFlag({ data: { key: flag.key, is_enabled: next } });
      toast.success(`${flag.label} ${next ? "enabled" : "disabled"}`);
      await qc.invalidateQueries({ queryKey: ["admin-feature-flags"] });
      await qc.invalidateQueries({ queryKey: ["feature-flags"] });
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || "Failed to update flag");
    } finally {
      setSavingKey(null);
    }
  };

  const handleBulk = async (category: string, enabled: boolean) => {
    try {
      await bulkUpdate({ data: { category, is_enabled: enabled } });
      toast.success(`${CATEGORY_LABELS[category] ?? category} ${enabled ? "enabled" : "disabled"}`);
      await qc.invalidateQueries({ queryKey: ["admin-feature-flags"] });
      await qc.invalidateQueries({ queryKey: ["feature-flags"] });
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || "Bulk update failed");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold">Feature Flags</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Turn website features on or off. Disabling a feature only hides it — data is never
          deleted.
        </p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search flags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">No feature flags found.</div>
      ) : (
        grouped.map(([category, flags]) => (
          <div key={category} className="border border-border rounded-xl bg-card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/30">
              <div>
                <h2 className="font-semibold text-base">{CATEGORY_LABELS[category] ?? category}</h2>
                <p className="text-xs text-muted-foreground">
                  {flags.length} feature{flags.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleBulk(category, true)}>
                  <ToggleRight className="w-4 h-4 mr-1" /> All on
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulk(category, false)}>
                  <ToggleLeft className="w-4 h-4 mr-1" /> All off
                </Button>
              </div>
            </div>
            <div className="divide-y divide-border">
              {flags.map((f) => (
                <div key={f.key} className="flex items-start justify-between p-4 gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{f.label}</span>
                      <code className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                        {f.key}
                      </code>
                    </div>
                    {f.description && (
                      <p className="text-sm text-muted-foreground mt-1">{f.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {savingKey === f.key && (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                    <Switch
                      checked={f.is_enabled}
                      disabled={savingKey === f.key}
                      onCheckedChange={(v) => handleToggle(f, v)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
