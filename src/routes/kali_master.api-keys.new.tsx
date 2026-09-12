import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  buildCredentialsPayload,
  BUILTIN_PROVIDERS,
  CUSTOM_BADGE_CLASS,
  isReservedKey,
  slugifyProviderKey,
  type FieldType,
  type IntegrationField,
} from "@/lib/integrations";

export const Route = createFileRoute("/kali_master/api-keys/new")({
  component: NewIntegrationPage,
});

interface DraftField extends IntegrationField {
  id: string;
}

function newDraftField(overrides: Partial<DraftField> = {}): DraftField {
  return {
    id: crypto.randomUUID(),
    name: "",
    label: "",
    type: "text",
    ...overrides,
  };
}

function NewIntegrationPage() {
  const navigate = useNavigate();
  const [label, setLabel] = useState("");
  const [providerKey, setProviderKey] = useState("");
  const [providerKeyTouched, setProviderKeyTouched] = useState(false);
  const [helpText, setHelpText] = useState("");
  const [helpUrl, setHelpUrl] = useState("");
  const [fields, setFields] = useState<DraftField[]>([
    newDraftField({ name: "api_key", label: "API Key", type: "text" }),
  ]);
  const [saving, setSaving] = useState(false);

  const autoKey = useMemo(() => slugifyProviderKey(label), [label]);
  const effectiveKey = providerKeyTouched ? providerKey : autoKey;
  const builtinKeys = useMemo(() => new Set(BUILTIN_PROVIDERS.map((p) => p.key)), []);

  function updateField(id: string, patch: Partial<DraftField>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }

  function addField() {
    setFields((prev) => [...prev, newDraftField()]);
  }

  function validate(): string | null {
    if (!label.trim()) return "Integration name is required";
    const key = effectiveKey;
    if (!key) return "A provider key could not be generated. Enter one manually.";
    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      return "Provider key must start with a letter and contain only lowercase letters, numbers, and underscores.";
    }
    if (builtinKeys.has(key)) {
      return `"${key}" is reserved for a built-in integration. Pick a different key.`;
    }
    if (fields.length === 0) return "Add at least one credential field";
    const seenNames = new Set<string>();
    for (const f of fields) {
      const name = f.name.trim();
      if (!name) return "Every field needs a name";
      if (!/^[a-z][a-z0-9_]*$/.test(name)) {
        return `Field name "${name}" must be lowercase letters, numbers, and underscores`;
      }
      if (isReservedKey(name)) {
        return `Field name "${name}" is reserved`;
      }
      if (seenNames.has(name)) {
        return `Field name "${name}" is duplicated`;
      }
      seenNames.add(name);
      if (!f.label.trim()) return `Field "${name}" needs a label`;
    }
    return null;
  }

  async function handleCreate() {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);

    // Check for existing custom row with same key
    const { data: existing, error: checkErr } = await supabase
      .from("api_credentials")
      .select("provider")
      .eq("provider", effectiveKey)
      .maybeSingle();
    if (checkErr) {
      toast.error(`Lookup failed: ${checkErr.message}`);
      setSaving(false);
      return;
    }
    if (existing) {
      toast.error(`An integration with key "${effectiveKey}" already exists`);
      setSaving(false);
      return;
    }

    const cleanFields: IntegrationField[] = fields.map((f) => ({
      name: f.name.trim(),
      label: f.label.trim(),
      type: f.type,
    }));

    const payload = buildCredentialsPayload(
      {
        key: effectiveKey,
        label: label.trim(),
        badgeClass: CUSTOM_BADGE_CLASS,
        helpText: helpText.trim() || "Custom integration.",
        helpUrl: helpUrl.trim() || undefined,
        fields: cleanFields,
        testable: false,
        isCustom: true,
      },
      {},
    );

    const { error } = await supabase.from("api_credentials").insert([
      {
        provider: effectiveKey,
        label: label.trim(),
        credentials: payload as any,
        is_active: false,
      },
    ]);
    setSaving(false);
    if (error) {
      toast.error(`Create failed: ${error.message}`);
      return;
    }
    toast.success(`${label.trim()} integration created`);
    navigate({
      to: "/kali_master/api-keys/$provider",
      params: { provider: effectiveKey },
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        to="/kali_master/api-keys"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Back to integrations
      </Link>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-xl">Add a new integration</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Define a custom integration: give it a name, describe its fields, then enter credentials
            on the next screen.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="int-label" className="text-xs">
              Integration name
            </Label>
            <Input
              id="int-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Stripe, Mailchimp, Twilio"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="int-key" className="text-xs">
              Provider key
            </Label>
            <Input
              id="int-key"
              value={effectiveKey}
              onChange={(e) => {
                setProviderKeyTouched(true);
                setProviderKey(e.target.value.toLowerCase());
              }}
              placeholder="auto-generated from name"
              className="font-mono text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Unique identifier used internally. Lowercase letters, numbers, and underscores only.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="int-help" className="text-xs">
              Help text (optional)
            </Label>
            <Input
              id="int-help"
              value={helpText}
              onChange={(e) => setHelpText(e.target.value)}
              placeholder="Short description shown on the integration card"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="int-url" className="text-xs">
              Docs URL (optional)
            </Label>
            <Input
              id="int-url"
              value={helpUrl}
              onChange={(e) => setHelpUrl(e.target.value)}
              placeholder="https://"
              type="url"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Credential fields</Label>
              <Button type="button" size="sm" variant="outline" onClick={addField}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add field
              </Button>
            </div>

            <div className="space-y-3">
              {fields.map((f, idx) => (
                <div
                  key={f.id}
                  className="rounded-md border border-border/60 p-3 space-y-2 bg-muted/30"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Field #{idx + 1}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeField(f.id)}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      aria-label="Remove field"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Name (key)</Label>
                      <Input
                        value={f.name}
                        onChange={(e) =>
                          updateField(f.id, {
                            name: e.target.value.toLowerCase(),
                          })
                        }
                        placeholder="api_key"
                        className="font-mono text-sm h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Label</Label>
                      <Input
                        value={f.label}
                        onChange={(e) => updateField(f.id, { label: e.target.value })}
                        placeholder="API Key"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Type</Label>
                      <Select
                        value={f.type}
                        onValueChange={(v) => updateField(f.id, { type: v as FieldType })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="password">Password (secret)</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}

              {fields.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  No fields yet. Add at least one.
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...
                </>
              ) : (
                "Create integration"
              )}
            </Button>
            <Link to="/kali_master/api-keys">
              <Button variant="outline">Cancel</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
