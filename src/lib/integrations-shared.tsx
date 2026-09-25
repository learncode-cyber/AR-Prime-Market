import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { KeyRound, Save, Trash2, ShieldCheck, AlertCircle, Wallet, Bitcoin } from "lucide-react";

export type ProviderKey = "semrush" | "ahrefs" | "dataforseo" | "serpapi" | "cron" | "imgbb";

export const SEO_PROVIDERS_INTEG: {
  key: ProviderKey;
  label: string;
  description: string;
  placeholder: string;
  helpUrl?: string;
}[] = [
  {
    key: "semrush",
    label: "Semrush",
    description: "Keyword research & competitor data.",
    placeholder: "Your Semrush API key",
    helpUrl: "https://www.semrush.com/api-documentation/",
  },
  {
    key: "ahrefs",
    label: "Ahrefs",
    description: "Backlink intelligence & keyword difficulty.",
    placeholder: "Your Ahrefs API token",
    helpUrl: "https://ahrefs.com/api",
  },
  {
    key: "dataforseo",
    label: "DataForSEO",
    description: "Affordable SERP, keyword and ranking data.",
    placeholder: "Your DataForSEO login:password (base64)",
    helpUrl: "https://dataforseo.com/apis",
  },
  {
    key: "serpapi",
    label: "SerpAPI",
    description: "Real-time Google SERP scraping.",
    placeholder: "Your SerpAPI key",
    helpUrl: "https://serpapi.com/manage-api-key",
  },
  {
    key: "cron",
    label: "Cron Secret",
    description: "Shared secret used by the 4:00 AM blog auto-generator. Rotate any time.",
    placeholder: "Long random string (32+ chars)",
  },
];

export function useIntegrationSettings() {
  return useQuery({
    queryKey: ["integration-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_settings")
        .select("provider, is_active, updated_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function ZeroKnowledgeNote() {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div className="text-sm space-y-1">
          <p className="font-medium text-foreground">Zero-knowledge storage</p>
          <p className="text-muted-foreground">
            The save button calls{" "}
            <code className="bg-secondary px-1 py-0.5 rounded text-xs">set_integration_secret</code>{" "}
            (admin-only RPC). Keys land in a separate table that no client — not even other admins
            on the public PostgREST API — can read back.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProviderCard({
  providerKey,
  label,
  description,
  placeholder,
  helpUrl,
  isActive,
  hasKey,
  updatedAt,
  loading,
}: {
  providerKey: ProviderKey;
  label: string;
  description: string;
  placeholder: string;
  helpUrl?: string;
  isActive: boolean;
  hasKey: boolean;
  updatedAt?: string | null;
  loading: boolean;
}) {
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [active, setActive] = useState(isActive);

  useEffect(() => setActive(isActive), [isActive]);

  const save = useMutation({
    mutationFn: async () => {
      const trimmed = value.trim();
      if (trimmed.length < 8) throw new Error("Key looks too short (min 8 chars).");
      if (trimmed.length > 2000) throw new Error("Key too long.");
      const { error } = await supabase.rpc("set_integration_secret", {
        p_provider: providerKey,
        p_api_key: trimmed,
        p_extra_config: {},
        p_activate: active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${label} key saved`);
      setValue("");
      qc.invalidateQueries({ queryKey: ["integration-settings"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save key"),
  });

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase
        .from("integration_settings")
        .update({ is_active: next })
        .eq("provider", providerKey);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integration-settings"] }),
    onError: (e: any) => toast.error(e?.message || "Toggle failed"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("delete_integration_secret", {
        p_provider: providerKey,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${label} key removed`);
      qc.invalidateQueries({ queryKey: ["integration-settings"] });
    },
    onError: (e: any) => toast.error(e?.message || "Delete failed"),
  });

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            {label}
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
          <CardDescription className="text-xs">{description}</CardDescription>
        </div>
        {hasKey && (
          <div className="flex items-center gap-2 shrink-0">
            <Label htmlFor={`active-${providerKey}`} className="text-xs text-muted-foreground">
              Enabled
            </Label>
            <Switch
              id={`active-${providerKey}`}
              checked={isActive}
              disabled={toggle.isPending}
              onCheckedChange={(v) => toggle.mutate(v)}
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2">
          <PasswordInput
            autoComplete="off"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={save.isPending || loading}
          />
          <div className="flex items-center gap-2 px-2 border border-border rounded-md">
            <Switch
              id={`activate-on-save-${providerKey}`}
              checked={active}
              onCheckedChange={setActive}
            />
            <Label
              htmlFor={`activate-on-save-${providerKey}`}
              className="text-xs whitespace-nowrap"
            >
              Activate on save
            </Label>
          </div>
          <Button onClick={() => save.mutate()} disabled={!value.trim() || save.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            {updatedAt && <span>Updated {new Date(updatedAt).toLocaleString()}</span>}
            {helpUrl && (
              <a
                href={helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Get API key →
              </a>
            )}
          </div>
          {hasKey && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Remove
            </Button>
          )}
        </div>
        {providerKey === "cron" && (
          <div className="flex items-start gap-2 text-xs bg-amber-500/10 border border-amber-500/20 rounded-md p-2 text-amber-700 dark:text-amber-400">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              The 4:00 AM cron sends this value in the{" "}
              <code className="bg-secondary px-1 rounded">x-cron-secret</code> header. After
              rotating, update the pg_cron schedule with the new value.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type SettingsRow = { provider: string; is_active: boolean; updated_at: string | null } | undefined;

function useGatewayConfig(providerKey: "bkash" | "binance") {
  return useQuery({
    queryKey: ["integration-extra", providerKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_settings")
        .select("extra_config")
        .eq("provider", providerKey)
        .maybeSingle();
      if (error) throw error;
      return (data?.extra_config as Record<string, any>) || {};
    },
  });
}

export function BkashCard({ row, loading }: { row: SettingsRow; loading: boolean }) {
  const qc = useQueryClient();
  const { data: cfg } = useGatewayConfig("bkash");
  const [appKey, setAppKey] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://tokenized.sandbox.bka.sh/v1.2.0-beta");
  const [active, setActive] = useState(!!row?.is_active);

  useEffect(() => setActive(!!row?.is_active), [row?.is_active]);
  useEffect(() => {
    if (cfg) {
      setAppKey(cfg.app_key || "");
      setUsername(cfg.username || "");
      setBaseUrl(cfg.base_url || "https://tokenized.sandbox.bka.sh/v1.2.0-beta");
    }
  }, [cfg]);

  const save = useMutation({
    mutationFn: async () => {
      if (!appKey.trim() || !appSecret.trim() || !username.trim() || !password.trim()) {
        throw new Error("All four bKash credentials are required");
      }
      const { error } = await supabase.rpc("set_integration_secret", {
        p_provider: "bkash",
        p_api_key: appSecret.trim(),
        p_extra_config: {
          app_key: appKey.trim(),
          username: username.trim(),
          password: password.trim(),
          base_url: baseUrl.trim() || "https://tokenized.sandbox.bka.sh/v1.2.0-beta",
        },
        p_activate: active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("bKash credentials saved");
      setAppSecret("");
      setPassword("");
      qc.invalidateQueries({ queryKey: ["integration-settings"] });
      qc.invalidateQueries({ queryKey: ["integration-extra", "bkash"] });
    },
    onError: (e: any) => toast.error(e?.message || "Save failed"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("delete_integration_secret", { p_provider: "bkash" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("bKash credentials removed");
      qc.invalidateQueries({ queryKey: ["integration-settings"] });
      qc.invalidateQueries({ queryKey: ["integration-extra", "bkash"] });
    },
    onError: (e: any) => toast.error(e?.message || "Delete failed"),
  });

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="w-4 h-4 text-pink-500" />
            bKash Sandbox
            {row ? (
              <Badge variant={row.is_active ? "default" : "secondary"} className="text-[10px]">
                {row.is_active ? "Active" : "Saved"}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Not set
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">
            Tokenized Checkout API (Bangladesh). Used by the bkash-pay edge function.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">App Key</Label>
            <Input
              value={appKey}
              onChange={(e) => setAppKey(e.target.value)}
              placeholder="bKash app_key"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">App Secret</Label>
            <PasswordInput
              autoComplete="off"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Username</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="sandboxTokenizedUser02"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Password</Label>
            <PasswordInput
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Base URL</Label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://tokenized.sandbox.bka.sh/v1.2.0-beta"
            />
            <p className="text-[10px] text-muted-foreground">
              Live: https://tokenized.pay.bka.sh/v1.2.0-beta
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
          <div className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-md">
            <Switch checked={active} onCheckedChange={setActive} id="bkash-active" />
            <Label htmlFor="bkash-active" className="text-xs">
              Activate on save
            </Label>
          </div>
          <div className="flex items-center gap-2">
            {row && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
              </Button>
            )}
            <Button onClick={() => save.mutate()} disabled={save.isPending || loading}>
              <Save className="w-4 h-4 mr-2" />
              {save.isPending ? "Saving…" : "Save bKash"}
            </Button>
          </div>
        </div>
        {row?.updated_at && (
          <p className="text-[10px] text-muted-foreground">
            Updated {new Date(row.updated_at).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function BinanceCard({ row, loading }: { row: SettingsRow; loading: boolean }) {
  const qc = useQueryClient();
  const { data: cfg } = useGatewayConfig("binance");
  const [merchantKey, setMerchantKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [active, setActive] = useState(!!row?.is_active);

  useEffect(() => setActive(!!row?.is_active), [row?.is_active]);
  useEffect(() => {
    if (cfg) setMerchantKey(cfg.merchant_api_key || "");
  }, [cfg]);

  const save = useMutation({
    mutationFn: async () => {
      if (!merchantKey.trim() || !apiSecret.trim()) {
        throw new Error("Both Binance Pay key and secret are required");
      }
      const { error } = await supabase.rpc("set_integration_secret", {
        p_provider: "binance",
        p_api_key: apiSecret.trim(),
        p_extra_config: { merchant_api_key: merchantKey.trim() },
        p_activate: active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Binance Pay credentials saved");
      setApiSecret("");
      qc.invalidateQueries({ queryKey: ["integration-settings"] });
      qc.invalidateQueries({ queryKey: ["integration-extra", "binance"] });
    },
    onError: (e: any) => toast.error(e?.message || "Save failed"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("delete_integration_secret", { p_provider: "binance" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Binance Pay credentials removed");
      qc.invalidateQueries({ queryKey: ["integration-settings"] });
      qc.invalidateQueries({ queryKey: ["integration-extra", "binance"] });
    },
    onError: (e: any) => toast.error(e?.message || "Delete failed"),
  });

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base flex items-center gap-2">
            <Bitcoin className="w-4 h-4 text-yellow-500" />
            Binance Pay
            {row ? (
              <Badge variant={row.is_active ? "default" : "secondary"} className="text-[10px]">
                {row.is_active ? "Active" : "Saved"}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Not set
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">
            Crypto checkout via Binance Pay merchant API. Signed with HMAC-SHA512.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Merchant API Key</Label>
            <Input
              value={merchantKey}
              onChange={(e) => setMerchantKey(e.target.value)}
              placeholder="BinancePay-Certificate-SN"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">API Secret</Label>
            <PasswordInput
              autoComplete="off"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
          <div className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-md">
            <Switch checked={active} onCheckedChange={setActive} id="binance-active" />
            <Label htmlFor="binance-active" className="text-xs">
              Activate on save
            </Label>
          </div>
          <div className="flex items-center gap-2">
            {row && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
              </Button>
            )}
            <Button onClick={() => save.mutate()} disabled={save.isPending || loading}>
              <Save className="w-4 h-4 mr-2" />
              {save.isPending ? "Saving…" : "Save Binance Pay"}
            </Button>
          </div>
        </div>
        {row?.updated_at && (
          <p className="text-[10px] text-muted-foreground">
            Updated {new Date(row.updated_at).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
