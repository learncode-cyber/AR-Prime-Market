import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Plus, Megaphone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/kali_master/fake-orders")({
  component: FakeOrdersPage,
});

interface Settings {
  id?: string;
  is_enabled: boolean;
  interval_seconds: number;
  display_seconds: number;
  names: string[];
  districts: string[];
}

const DEFAULTS: Settings = {
  is_enabled: true,
  interval_seconds: 45,
  display_seconds: 5,
  names: [],
  districts: [],
};

function ChipEditor({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v) return;
    if (values.includes(v)) return;
    onChange([...values, v]);
    setDraft("");
  }
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5 p-2 border rounded-md bg-muted/30 min-h-[44px]">
        {values.length === 0 && (
          <span className="text-xs text-muted-foreground self-center">No entries yet</span>
        )}
        {values.map((v) => (
          <Badge key={v} variant="secondary" className="gap-1">
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="hover:text-destructive"
              aria-label={`Remove ${v}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" onClick={add} aria-label={`Add ${label}`}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function FakeOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .from("fake_order_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) {
        toast.error("Failed to load settings");
      } else if (data) {
        setSettings({ ...DEFAULTS, ...data });
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    const payload = {
      is_enabled: settings.is_enabled,
      interval_seconds: Math.max(10, Number(settings.interval_seconds) || 45),
      display_seconds: Math.max(2, Number(settings.display_seconds) || 5),
      names: settings.names,
      districts: settings.districts,
    };
    let error;
    if (settings.id) {
      ({ error } = await (supabase as any)
        .from("fake_order_settings")
        .update(payload)
        .eq("id", settings.id));
    } else {
      ({ error } = await (supabase as any).from("fake_order_settings").insert(payload));
    }
    setSaving(false);
    if (error) {
      toast.error(`Save failed: ${error.message}`);
    } else {
      toast.success("Fake order settings saved");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Megaphone className="h-6 w-6" /> Fake Order Notifications
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Drive social proof by showing realistic "someone just purchased" toasts on the storefront.
          Popups never render inside the admin area.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="enabled" className="cursor-pointer">
                  Enable popups
                </Label>
                <p className="text-xs text-muted-foreground">
                  Toggle storefront notifications on or off
                </p>
              </div>
              <Switch
                id="enabled"
                checked={settings.is_enabled}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, is_enabled: v }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="interval">Interval (seconds)</Label>
                <Input
                  id="interval"
                  type="number"
                  min={10}
                  value={settings.interval_seconds}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, interval_seconds: Number(e.target.value) }))
                  }
                />
                <p className="text-[11px] text-muted-foreground">How often a new popup appears</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="display">Display duration (seconds)</Label>
                <Input
                  id="display"
                  type="number"
                  min={2}
                  value={settings.display_seconds}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, display_seconds: Number(e.target.value) }))
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  How long each popup stays visible
                </p>
              </div>
            </div>

            <ChipEditor
              label="Customer names"
              values={settings.names}
              onChange={(v) => setSettings((s) => ({ ...s, names: v }))}
              placeholder="Add a name and press Enter"
            />

            <ChipEditor
              label="Districts / cities"
              values={settings.districts}
              onChange={(v) => setSettings((s) => ({ ...s, districts: v }))}
              placeholder="Add a district and press Enter"
            />

            <div className="flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
