import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getVapidKey, savePushSubscription, sendTestPush } from "@/lib/push.functions";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PushPanel() {
  const vapid = useServerFn(getVapidKey);
  const saveSub = useServerFn(savePushSubscription);
  const testPush = useServerFn(sendTestPush);

  const [subscribed, setSubscribed] = useState(false);
  const [pushTitle, setPushTitle] = useState("AR Prime Market");
  const [pushBody, setPushBody] = useState("Test notification 🔔");

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  const subscribe = useMutation({
    mutationFn: async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Browser-এ push support নেই");
      }
      const reg = await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("Permission denied");
      const { publicKey } = await vapid();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      await saveSub({
        data: {
          endpoint: json.endpoint!,
          p256dh: json.keys!.p256dh!,
          auth: json.keys!.auth!,
          user_agent: navigator.userAgent.slice(0, 200),
        },
      });
      return true;
    },
    onSuccess: () => {
      setSubscribed(true);
      toast.success("Push subscribed ✓");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fire = useMutation({
    mutationFn: () =>
      testPush({ data: { title: pushTitle, body: pushBody, url: "/kali_master/ai-agent" } }),
    onSuccess: (r) => toast.success(`Push sent — ${r.sent} delivered, ${r.failed} failed`),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <BellRing className="w-4 h-4" /> Web Push
          </h3>
          <p className="text-xs text-muted-foreground">Admin devices-এ push notification পাঠান</p>
        </div>
        {subscribed && (
          <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
            Subscribed
          </Badge>
        )}
      </div>

      <div className="rounded-lg border p-3 space-y-2">
        <div className="text-sm font-medium flex items-center gap-2">
          <Bell className="w-4 h-4" /> Subscribe
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => subscribe.mutate()}
          disabled={subscribe.isPending}
        >
          {subscribe.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
          Subscribe this device
        </Button>
      </div>

      <div className="rounded-lg border p-3 space-y-2">
        <div className="text-sm font-medium">Send test push</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Input
            value={pushTitle}
            onChange={(e) => setPushTitle(e.target.value)}
            placeholder="Title"
          />
          <Input
            value={pushBody}
            onChange={(e) => setPushBody(e.target.value)}
            placeholder="Body"
          />
        </div>
        <Button size="sm" onClick={() => fire.mutate()} disabled={fire.isPending}>
          {fire.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
          Send push to all admins
        </Button>
      </div>
    </Card>
  );
}
