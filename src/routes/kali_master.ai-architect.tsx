import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { architectGenerate } from "@/lib/ai-architect.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Sparkles, KeyRound, Save, Trash2, Wand2, AlertCircle, Code2 } from "lucide-react";

export const Route = createFileRoute("/kali_master/ai-architect")({
  component: AdminAIArchitect,
});

function AdminAIArchitect() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          Claude Code Architect
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Describe a layout, color, spacing, or content change in plain English. Claude 3.5 Sonnet
          returns Tailwind classes + structured JSON that the live site picks up via realtime — no
          redeploy needed.
        </p>
      </div>

      <ClaudeKeyCard />
      <ArchitectChatCard />
      <SettingsListCard />

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 flex items-start gap-3 text-sm">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-1 text-amber-800 dark:text-amber-200">
            <p className="font-medium">Safety guardrail</p>
            <p className="text-xs">
              The Architect only stores Tailwind classes and structured JSON data. Arbitrary
              JavaScript is <strong>never executed</strong> on your live site, even if the model
              returns it — this prevents XSS via prompt injection. Use Tailwind utilities +
              JSON-driven content to control layout safely.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────── Claude key card ───────────────────────────

function ClaudeKeyCard() {
  const qc = useQueryClient();
  const [value, setValue] = useState("");

  const { data: hasKey } = useQuery({
    queryKey: ["integration-settings", "anthropic"],
    queryFn: async () => {
      const { data } = await supabase
        .from("integration_settings")
        .select("provider, is_active")
        .eq("provider", "anthropic")
        .maybeSingle();
      return !!data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const trimmed = value.trim();
      if (!trimmed.startsWith("sk-ant-")) throw new Error("Anthropic keys start with sk-ant-");
      const { error } = await supabase.rpc("set_integration_secret", {
        p_provider: "anthropic",
        p_api_key: trimmed,
        p_extra_config: {},
        p_activate: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Claude API key saved securely");
      setValue("");
      qc.invalidateQueries({ queryKey: ["integration-settings"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save key"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("delete_integration_secret", {
        p_provider: "anthropic",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Claude key removed");
      qc.invalidateQueries({ queryKey: ["integration-settings"] });
    },
  });

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary" />
          Anthropic Claude API Key
          {hasKey ? (
            <Badge className="text-[10px]">Active</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              Not set
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="text-xs">
          Stored server-only in <code>integration_secrets</code> — no client ever reads it back. If
          unset, the Architect falls back to Gemini.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2">
          <PasswordInput
            autoComplete="off"
            placeholder="sk-ant-api03-..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={save.isPending}
          />
          <Button onClick={() => save.mutate()} disabled={!value.trim() || save.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          {hasKey && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Get a key at{" "}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            console.anthropic.com
          </a>
          .
        </p>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────── Architect prompt ───────────────────────────

function ArchitectChatCard() {
  const fn = useServerFn(architectGenerate);
  const qc = useQueryClient();
  const [componentName, setComponentName] = useState("home.hero");
  const [prompt, setPrompt] = useState("");
  const [apply, setApply] = useState(true);
  const [lastResult, setLastResult] = useState<null | {
    summary: string | null;
    css_classes: string;
    json_data: unknown;
    providerUsed: string;
  }>(null);

  const generate = useMutation({
    mutationFn: async () =>
      fn({
        data: {
          prompt: prompt.trim(),
          componentName: componentName.trim(),
          applyImmediately: apply,
        },
      }),
    onSuccess: (r) => {
      setLastResult({
        summary: r.summary,
        css_classes: r.css_classes,
        json_data: r.json_data,
        providerUsed: r.providerUsed,
      });
      if (apply) {
        toast.success("Applied live to the site");
        qc.invalidateQueries({ queryKey: ["dynamic-ui-settings"] });
      } else {
        toast.success("Preview ready — toggle 'Apply live' to publish");
      }
    },
    onError: (e: any) => toast.error(e?.message || "Generation failed"),
  });

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-primary" />
          Send a design request
        </CardTitle>
        <CardDescription className="text-xs">
          Reference any component your codebase calls <code>useDynamicUI("component.name")</code> on
          (e.g. <code>home.hero</code>, <code>nav.cta</code>, <code>footer.cta</code>).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-[200px_1fr] gap-2">
          <div className="space-y-1">
            <Label htmlFor="component-name" className="text-xs">
              Component
            </Label>
            <Input
              id="component-name"
              value={componentName}
              onChange={(e) => setComponentName(e.target.value)}
              placeholder="home.hero"
              disabled={generate.isPending}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="prompt" className="text-xs">
              Request
            </Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder='e.g. "Make the hero darker with a gold accent CTA and tighten vertical spacing on mobile"'
              rows={4}
              disabled={generate.isPending}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Switch id="apply-live" checked={apply} onCheckedChange={setApply} />
            <Label htmlFor="apply-live" className="text-xs">
              Apply live (publish to site)
            </Label>
          </div>
          <Button
            onClick={() => generate.mutate()}
            disabled={!prompt.trim() || !componentName.trim() || generate.isPending}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {generate.isPending ? "Thinking…" : "Generate with Claude"}
          </Button>
        </div>

        {lastResult && (
          <div className="mt-4 space-y-3 rounded-lg border border-border/60 bg-secondary/30 p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Code2 className="w-3.5 h-3.5" />
              <span>
                Provider:{" "}
                <Badge variant="secondary" className="text-[10px]">
                  {lastResult.providerUsed}
                </Badge>
              </span>
            </div>
            {lastResult.summary && <p className="text-sm">{lastResult.summary}</p>}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Tailwind classes</p>
              <pre className="text-xs bg-background border border-border rounded p-2 overflow-x-auto whitespace-pre-wrap break-words">
                {lastResult.css_classes || "(none)"}
              </pre>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">JSON data</p>
              <pre className="text-xs bg-background border border-border rounded p-2 overflow-x-auto">
                {JSON.stringify(lastResult.json_data, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────── Saved settings list ───────────────────────────

function SettingsListCard() {
  const qc = useQueryClient();
  const { data: rows, isLoading } = useQuery({
    queryKey: ["dynamic-ui-settings", "all"],
    queryFn: async () => {
      const { data, error } = await (
        supabase.rpc as unknown as (fn: string) => Promise<{ data: unknown; error: unknown }>
      )("get_dynamic_ui_settings_admin");
      if (error) throw error;
      return (
        (data as Array<{
          id: string;
          component_name: string;
          css_classes: string | null;
          json_data: unknown;
          prompt: string | null;
          is_active: boolean;
          updated_at: string;
        }>) ?? []
      );
    },
  });

  const toggle = useMutation({
    mutationFn: async (vars: { id: string; next: boolean }) => {
      const { error } = await supabase
        .from("dynamic_ui_settings")
        .update({ is_active: vars.next })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dynamic-ui-settings"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dynamic_ui_settings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Override removed");
      qc.invalidateQueries({ queryKey: ["dynamic-ui-settings"] });
    },
  });

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Active overrides</CardTitle>
        <CardDescription className="text-xs">
          Every row here is broadcast in realtime — toggling Active flips the site instantly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && (!rows || rows.length === 0) && (
          <p className="text-sm text-muted-foreground">No overrides yet — generate one above.</p>
        )}
        {rows?.map((row) => (
          <div key={row.id} className="border border-border/60 rounded-lg p-3 space-y-2 bg-card">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold truncate">{row.component_name}</p>
                {row.prompt && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{row.prompt}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={!!row.is_active}
                  onCheckedChange={(v) => toggle.mutate({ id: row.id, next: v })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive h-8 w-8"
                  onClick={() => remove.mutate(row.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            {row.css_classes && (
              <pre className="text-[11px] bg-secondary/40 border border-border/40 rounded p-1.5 overflow-x-auto whitespace-pre-wrap break-words">
                {row.css_classes}
              </pre>
            )}
            <p className="text-[10px] text-muted-foreground">
              Updated {new Date(row.updated_at).toLocaleString()}
            </p>
          </div>
        ))}
        <Separator className="my-2" />
        <p className="text-[11px] text-muted-foreground">
          Tip: Wire a component to live overrides by adding{" "}
          <code className="bg-secondary px-1 py-0.5 rounded">
            {'const cls = useDynamicClasses("home.hero", "base-classes")'}
          </code>{" "}
          from <code>@/context/DynamicUIContext</code>.
        </p>
      </CardContent>
    </Card>
  );
}
