import { createFileRoute } from "@tanstack/react-router";
import { AdminPending, AdminErrorComponent, AdminNotFound } from "@/lib/admin-route-boundaries";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, Plug, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { callProxy, type KeyStatus } from "@/lib/cj-settings-shared";

export const Route = createFileRoute("/kali_master/cj-settings/api")({
  pendingComponent: () => <AdminPending />,
  errorComponent: AdminErrorComponent,
  notFoundComponent: AdminNotFound,
  component: CjApiSection,
});

function CjApiSection() {
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await callProxy<KeyStatus>("keyStatus");
        setKeyStatus(s);
      } catch (e: unknown) {
        toast.error(`Status check failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
  }, []);

  async function handleTest() {
    setTesting(true);
    try {
      await callProxy("testConnection");
      toast.success("CJ connection OK");
      const s = await callProxy<KeyStatus>("keyStatus");
      setKeyStatus(s);
    } catch (e: unknown) {
      toast.error(`Test failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTesting(false);
    }
  }

  async function handleSaveKey() {
    if (!apiKey.trim()) return toast.error("Enter an API key");
    setSavingKey(true);
    try {
      await callProxy("updateApiKey", { apiKey: apiKey.trim() });
      toast.success("API key saved & validated");
      setApiKey("");
      const s = await callProxy<KeyStatus>("keyStatus");
      setKeyStatus(s);
    } catch (e: unknown) {
      toast.error(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSavingKey(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="w-4 h-4" /> API Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          {keyStatus?.configured ? (
            <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1">
              <CheckCircle2 className="w-3 h-3" /> Connected
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="w-3 h-3" /> Not connected
            </Badge>
          )}
          {keyStatus?.lastConnectedAt && (
            <span className="text-xs text-muted-foreground">
              Last token: {new Date(keyStatus.lastConnectedAt).toLocaleString()}
            </span>
          )}
          {keyStatus?.expiresAt && (
            <span className="text-xs text-muted-foreground">
              Expires: {new Date(keyStatus.expiresAt).toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Input
              type={showKey ? "text" : "password"}
              placeholder="Paste CJ API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showKey ? "Hide" : "Show"}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Button onClick={handleSaveKey} disabled={savingKey || !apiKey.trim()}>
            {savingKey ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <KeyRound className="w-4 h-4 mr-2" />
            )}
            Save API Key
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Plug className="w-4 h-4 mr-2" />
            )}
            Test Connection
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Key is stored in Supabase Vault (encrypted) — never exposed to the browser.
        </p>
      </CardContent>
    </Card>
  );
}
