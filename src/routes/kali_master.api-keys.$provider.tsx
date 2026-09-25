import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  buildCredentialsPayload,
  findProvider,
  pickCredentialValues,
  type IntegrationDef,
  type StoredCredRow,
} from "@/lib/integrations";

export const Route = createFileRoute("/kali_master/api-keys/$provider")({
  component: ApiKeyDetailPage,
});

interface TestResult {
  ok: boolean;
  message: string;
}

function ApiKeyDetailPage() {
  const { provider } = useParams({ from: "/kali_master/api-keys/$provider" });
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [def, setDef] = useState<IntegrationDef | null>(null);
  const [row, setRow] = useState<StoredCredRow | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [autoTest, setAutoTest] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("api_credentials").select("*");
    if (error) {
      toast.error("Failed to load credentials");
      setLoading(false);
      return;
    }
    const rows = (data || []) as StoredCredRow[];
    const found = findProvider(rows, provider);
    setDef(found ?? null);
    const matchingRow = rows.find((r) => r.provider === provider) ?? null;
    setRow(matchingRow);
    if (matchingRow) {
      setValues(pickCredentialValues(matchingRow.credentials));
    } else {
      setValues({});
    }
    setLoading(false);
  }, [provider]);

  useEffect(() => {
    void load();
  }, [load]);

  function update(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function runTest(p: IntegrationDef): Promise<TestResult> {
    setTesting(true);
    setTestResult(null);
    let result: TestResult;
    try {
      const { data, error } = await supabase.functions.invoke("test-credentials", {
        body: { provider: p.key },
      });
      if (error) {
        result = { ok: false, message: error.message || "Request failed" };
      } else {
        result = {
          ok: !!data?.ok,
          message: data?.message || (data?.ok ? "OK" : "Failed"),
        };
      }
    } catch (e) {
      result = {
        ok: false,
        message: e instanceof Error ? e.message : "Network error",
      };
    } finally {
      setTesting(false);
    }
    setTestResult(result);
    return result;
  }

  async function save() {
    if (!def) return;
    setSaving(true);
    const payload = buildCredentialsPayload(def, values);
    const { error } = await supabase.from("api_credentials").upsert(
      [
        {
          provider: def.key,
          label: def.label,
          credentials: payload as any,
          is_active: true,
        },
      ],
      { onConflict: "provider" },
    );
    setSaving(false);
    if (error) {
      toast.error(`Save failed: ${error.message}`);
      return;
    }
    toast.success(`${def.label} credentials saved`);
    await load();
    if (autoTest && def.testable) {
      const result = await runTest(def);
      if (result.ok) {
        toast.success(`${def.label} connection test passed`, {
          description: result.message,
        });
      } else {
        toast.error(`${def.label} connection test failed`, {
          description: result.message,
        });
      }
    }
  }

  async function handleDelete() {
    if (!def) return;
    if (!confirm(`Delete the saved credentials for ${def.label}? This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    const { error } = await supabase.from("api_credentials").delete().eq("provider", def.key);
    setDeleting(false);
    if (error) {
      toast.error(`Delete failed: ${error.message}`);
      return;
    }
    toast.success("Credentials deleted");
    if (def.isCustom) {
      navigate({ to: "/kali_master/api-keys" });
    } else {
      await load();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!def) {
    return (
      <div className="space-y-4">
        <Link
          to="/kali_master/api-keys"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Back to integrations
        </Link>
        <Card>
          <CardContent className="py-10 text-center">
            <h2 className="text-lg font-semibold mb-1">Integration not found</h2>
            <p className="text-sm text-muted-foreground">
              No provider matches <code>{provider}</code>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isConnected = !!row?.is_active;
  const updatedAt = row?.updated_at ? new Date(row.updated_at).toLocaleString() : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        to="/kali_master/api-keys"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Back to integrations
      </Link>

      <Card className="border-border/50">
        <CardHeader className="space-y-2">
          <div className="flex flex-row items-start justify-between gap-2">
            <CardTitle className="text-xl flex items-center gap-2">
              {def.label}
              {def.isCustom && (
                <Badge variant="outline" className="text-[10px]">
                  Custom
                </Badge>
              )}
            </CardTitle>
            <Badge
              className={
                isConnected ? def.badgeClass : "bg-muted text-muted-foreground hover:bg-muted"
              }
            >
              {isConnected ? "Connected" : "Not Set"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {def.helpText}
            {def.helpUrl && (
              <>
                {" "}
                <a
                  href={def.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-primary hover:underline"
                >
                  Docs <ExternalLink className="w-3 h-3" />
                </a>
              </>
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {def.fields.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              This integration has no fields configured.
            </p>
          ) : (
            <div className="space-y-3">
              {def.fields.map((f) => {
                const fieldId = `${def.key}-${f.name}`;
                const isPassword = f.type === "password";
                const showPlain = !!reveal[fieldId];
                const currentVal = values[f.name] ?? "";
                const storedVal = (row?.credentials as Record<string, unknown> | undefined)?.[
                  f.name
                ];
                const placeholder =
                  isPassword && typeof storedVal === "string" && storedVal && !currentVal
                    ? "••••••••"
                    : "";
                return (
                  <div key={f.name} className="space-y-1.5">
                    <Label htmlFor={fieldId} className="text-xs">
                      {f.label}
                    </Label>
                    <div className="relative">
                      <Input
                        id={fieldId}
                        type={
                          isPassword && !showPlain
                            ? "password"
                            : f.type === "email"
                              ? "email"
                              : "text"
                        }
                        value={currentVal}
                        placeholder={placeholder}
                        onChange={(e) => update(f.name, e.target.value)}
                        className={isPassword ? "pr-9" : ""}
                        autoComplete="off"
                      />
                      {isPassword && (
                        <button
                          type="button"
                          aria-label={showPlain ? "Hide" : "Show"}
                          onClick={() =>
                            setReveal((r) => ({
                              ...r,
                              [fieldId]: !r[fieldId],
                            }))
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPlain ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {updatedAt && (
            <p className="text-[11px] text-muted-foreground">Last updated: {updatedAt}</p>
          )}

          {testResult && (
            <div
              className={`flex items-start gap-2 text-xs rounded-md p-2 ${
                testResult.ok
                  ? "bg-green-500/10 text-green-700 dark:text-green-400"
                  : "bg-red-500/10 text-red-700 dark:text-red-400"
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span className="break-words">{testResult.message}</span>
            </div>
          )}

          {def.testable && (
            <div className="flex items-center gap-2">
              <Switch id="auto-test" checked={autoTest} onCheckedChange={setAutoTest} />
              <Label htmlFor="auto-test" className="text-sm cursor-pointer">
                Auto-test after save
              </Label>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={save} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
            {def.testable && (
              <Button
                variant="outline"
                onClick={() => runTest(def)}
                disabled={testing || !isConnected}
                title={!isConnected ? "Save credentials first" : "Test connection"}
              >
                {testing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testing...
                  </>
                ) : (
                  "Test Connection"
                )}
              </Button>
            )}
            {row && (
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    {def.isCustom ? "Delete integration" : "Clear credentials"}
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
