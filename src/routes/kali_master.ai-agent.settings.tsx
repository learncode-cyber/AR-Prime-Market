import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Brain, KeyRound, Save, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AiAgentSubnav } from "@/components/admin/agent/AiAgentSubnav";

export const Route = createFileRoute("/kali_master/ai-agent/settings")({
  component: BrainSettingsPage,
});

type ModelKey = "gemini-3-flash" | "gpt-4o" | "claude-3-5-sonnet";

const MODELS: {
  value: ModelKey;
  label: string;
  provider: "gemini" | "openai" | "anthropic";
  hint: string;
}[] = [
  {
    value: "gemini-3-flash",
    label: "Gemini 3 Flash (default)",
    provider: "gemini",
    hint: "Fast & cost-effective, admin-panel configurable key",
  },
  { value: "gpt-4o", label: "OpenAI GPT-4o", provider: "openai", hint: "Requires OPENAI_API_KEY" },
  {
    value: "claude-3-5-sonnet",
    label: "Anthropic Claude 3.5 Sonnet",
    provider: "anthropic",
    hint: "Requires ANTHROPIC_API_KEY",
  },
];

const SECRET_PROVIDERS = [
  {
    provider: "openai",
    label: "OpenAI API Key",
    placeholder: "sk-...",
    help: "https://platform.openai.com/api-keys",
  },
  {
    provider: "anthropic",
    label: "Anthropic API Key",
    placeholder: "sk-ant-...",
    help: "https://console.anthropic.com/settings/keys",
  },
  {
    provider: "gemini",
    label: "Google Gemini API Key",
    placeholder: "AIza...",
    help: "https://aistudio.google.com/apikey",
  },
] as const;

function BrainSettingsPage() {
  const qc = useQueryClient();

  const { data: cfg } = useQuery({
    queryKey: ["agent_config", "active_ai_model"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_config")
        .select("key, value")
        .eq("key", "active_ai_model")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: secrets } = useQuery({
    queryKey: ["integration-settings", "ai-providers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_settings")
        .select("provider, is_active, updated_at")
        .in("provider", ["openai", "anthropic", "gemini"]);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [model, setModel] = useState<ModelKey>("gemini-3-flash");
  useEffect(() => {
    const v = (cfg?.value as any)?.model as ModelKey | undefined;
    if (v) setModel(v);
  }, [cfg]);

  const saveModel = useMutation({
    mutationFn: async (next: ModelKey) => {
      const meta = MODELS.find((m) => m.value === next)!;
      const { error } = await supabase
        .from("agent_config")
        .upsert(
          { key: "active_ai_model", value: { model: next, provider: meta.provider } },
          { onConflict: "key" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Active AI model updated");
      qc.invalidateQueries({ queryKey: ["agent_config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="w-6 h-6 text-primary" /> Autonomous AI Brain Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage the active reasoning model and provider API keys used by every nightly autonomous
          loop (ad-monitor, learning engine, CEO report, support chat).
        </p>
      </div>

      <AiAgentSubnav />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-primary" /> Active Reasoning Model
          </CardTitle>
          <CardDescription>
            The selected model is read at runtime by the learning engine, support chat and decision
            agents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <Label className="text-xs">Model</Label>
              <Select value={model} onValueChange={(v) => setModel(v as ModelKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      <div className="flex flex-col">
                        <span>{m.label}</span>
                        <span className="text-xs text-muted-foreground">{m.hint}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => saveModel.mutate(model)} disabled={saveModel.isPending}>
              <Save className="w-4 h-4 mr-2" />
              {saveModel.isPending ? "Saving…" : "Save model"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Auto-learning loops read this value on each run and pull recent{" "}
            <code className="bg-muted px-1 rounded">telegram_chat_history</code>, ad performance and
            order metrics as analysis input.
          </p>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm space-y-1">
            <p className="font-medium">Zero-knowledge storage</p>
            <p className="text-muted-foreground">
              Keys are saved via the admin-only{" "}
              <code className="bg-secondary px-1 py-0.5 rounded text-xs">
                set_integration_secret
              </code>{" "}
              RPC. They land in a private table only edge functions (service-role) can read — never
              exposed to the browser.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {SECRET_PROVIDERS.map((p) => {
          const row = secrets?.find((s) => s.provider === p.provider);
          return (
            <SecretCard
              key={p.provider}
              provider={p.provider}
              label={p.label}
              placeholder={p.placeholder}
              help={p.help}
              hasKey={!!row}
              isActive={!!row?.is_active}
              updatedAt={row?.updated_at}
            />
          );
        })}
      </div>
    </div>
  );
}

function SecretCard({
  provider,
  label,
  placeholder,
  help,
  hasKey,
  isActive,
  updatedAt,
}: {
  provider: string;
  label: string;
  placeholder: string;
  help: string;
  hasKey: boolean;
  isActive: boolean;
  updatedAt?: string | null;
}) {
  const qc = useQueryClient();
  const [value, setValue] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const k = value.trim();
      if (k.length < 8) throw new Error("Key looks too short");
      const { error } = await supabase.rpc("set_integration_secret", {
        p_provider: provider,
        p_api_key: k,
        p_extra_config: {},
        p_activate: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${label} saved`);
      setValue("");
      qc.invalidateQueries({ queryKey: ["integration-settings", "ai-providers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" /> {label}
            {hasKey ? (
              <Badge variant={isActive ? "default" : "secondary"} className="text-[10px]">
                {isActive ? "Active" : "Saved"}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Not set
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">
            Stored encrypted in <code>integration_secrets</code> · read by edge functions via
            service role.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-[1fr_auto] gap-2">
          <PasswordInput
            autoComplete="off"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button onClick={() => save.mutate()} disabled={!value.trim() || save.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {save.isPending ? "Saving…" : hasKey ? "Update" : "Save"}
          </Button>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {updatedAt ? <span>Updated {new Date(updatedAt).toLocaleString()}</span> : <span />}
          <a
            href={help}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Get API key →
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
