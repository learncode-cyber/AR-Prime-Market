import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CONTACT_EMAIL = "mailto:notifications@arprimemarket.shop";

async function loadVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const [{ data: secret }, { data: setting }] = await Promise.all([
    supabaseAdmin
      .from("integration_secrets")
      .select("api_key")
      .eq("provider", "vapid")
      .maybeSingle(),
    supabaseAdmin
      .from("integration_settings")
      .select("extra_config")
      .eq("provider", "vapid")
      .maybeSingle(),
  ]);
  const pub = (setting as any)?.extra_config?.public_key as string | undefined;
  if ((secret as any)?.api_key && pub) {
    return { publicKey: pub, privateKey: (secret as any).api_key };
  }
  const keys = webpush.generateVAPIDKeys();
  await supabaseAdmin.from("integration_secrets").upsert(
    {
      provider: "vapid",
      api_key: keys.privateKey,
    } as never,
    { onConflict: "provider" },
  );
  await supabaseAdmin.from("integration_settings").upsert(
    {
      provider: "vapid",
      is_active: true,
      extra_config: { public_key: keys.publicKey },
    } as never,
    { onConflict: "provider" },
  );
  return keys;
}

export async function getVapidPublicKey(): Promise<string> {
  const k = await loadVapidKeys();
  return k.publicKey;
}

export async function sendWebPushToAllAdmins(
  title: string,
  body: string,
  url = "/",
): Promise<{ sent: number; failed: number }> {
  const keys = await loadVapidKeys();
  webpush.setVapidDetails(CONTACT_EMAIL, keys.publicKey, keys.privateKey);

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth");

  let sent = 0,
    failed = 0;
  const payload = JSON.stringify({ title, body, url });

  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      );
      sent++;
      await supabaseAdmin
        .from("push_subscriptions")
        .update({ last_used_at: new Date().toISOString() } as never)
        .eq("id", s.id);
    } catch (err: unknown) {
      failed++;
      // Remove dead subscriptions
      if (
        (err as Record<string, unknown>).statusCode === 404 ||
        (err as Record<string, unknown>).statusCode === 410
      ) {
        await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
      }
    }
  }
  return { sent, failed };
}
