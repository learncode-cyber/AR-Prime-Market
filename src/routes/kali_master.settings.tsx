import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Settings as SettingsIcon, Loader2 } from "lucide-react";
import {
  EditModeProvider,
  EditModeToggle,
  EditModeFieldset,
  useEditMode,
} from "@/components/admin/EditModeShell";

export const Route = createFileRoute("/kali_master/settings")({
  component: () => (
    <EditModeProvider>
      <AdminSettings />
    </EditModeProvider>
  ),
});

type StoreSettings = {
  store_name: string;
  support_email: string;
  support_phone: string;
  currency: string;
  free_shipping_threshold: number;
  cod_enabled: boolean;
};

const DEFAULTS: StoreSettings = {
  store_name: "AR Prime Market",
  support_email: "",
  support_phone: "",
  currency: "USD",
  free_shipping_threshold: 50,
  cod_enabled: true,
};

const SECTION = "store_settings";

function AdminSettings() {
  const { lock } = useEditMode();
  const [form, setForm] = useState<StoreSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rowId, setRowId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("site_content")
        .select("id, content_data")
        .eq("section_name", SECTION)
        .maybeSingle();
      if (data) {
        setRowId(data.id);
        setForm({ ...DEFAULTS, ...((data.content_data as Partial<StoreSettings>) || {}) });
      }
      setLoading(false);
    })();
  }, []);

  const update = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      section_name: SECTION,
      content_data: form as unknown as any,
      is_active: true,
    };
    const { data, error } = rowId
      ? await supabase
          .from("site_content")
          .update(payload)
          .eq("id", rowId)
          .select("id")
          .maybeSingle()
      : await supabase.from("site_content").insert(payload).select("id").maybeSingle();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data?.id) setRowId(data.id);
    toast.success("Settings saved to database");
    lock();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <SettingsIcon className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Store Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              All changes are saved directly to the database.
            </p>
          </div>
        </div>
        <EditModeToggle />
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <EditModeFieldset>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Store Name</Label>
                <Input
                  className="mt-1"
                  value={form.store_name}
                  onChange={(e) => update("store_name", e.target.value)}
                  placeholder="AR Prime Market"
                />
              </div>
              <div>
                <Label>Default Currency</Label>
                <Input
                  className="mt-1 font-mono"
                  value={form.currency}
                  onChange={(e) => update("currency", e.target.value.toUpperCase())}
                  placeholder="USD"
                  maxLength={3}
                />
              </div>
              <div>
                <Label>Support Email</Label>
                <Input
                  type="email"
                  className="mt-1"
                  value={form.support_email}
                  onChange={(e) => update("support_email", e.target.value)}
                  placeholder="support@example.com"
                />
              </div>
              <div>
                <Label>Support Phone</Label>
                <Input
                  className="mt-1"
                  value={form.support_phone}
                  onChange={(e) => update("support_phone", e.target.value)}
                  placeholder="+1 555 000 0000"
                />
              </div>
              <div>
                <Label>Free Shipping Threshold</Label>
                <Input
                  type="number"
                  min={0}
                  className="mt-1"
                  value={form.free_shipping_threshold}
                  onChange={(e) => update("free_shipping_threshold", Number(e.target.value) || 0)}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Orders above this amount get free shipping.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 mt-6 sm:mt-0">
                <div>
                  <Label className="text-sm">Cash on Delivery</Label>
                  <p className="text-[11px] text-muted-foreground">Allow COD at checkout</p>
                </div>
                <Switch
                  checked={form.cod_enabled}
                  onCheckedChange={(v) => update("cod_enabled", v)}
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…
                  </>
                ) : (
                  "সেভ করুন"
                )}
              </Button>
            </div>
          </EditModeFieldset>
        </CardContent>
      </Card>
    </div>
  );
}
