// Client helper to mirror Meta Pixel events to our Supabase Edge Function
// (meta-capi), which forwards them to Meta's Conversions API server-side.
// Fire-and-forget — never blocks shopper flow, never throws.

import { supabase } from "@/integrations/supabase/client";

export interface CapiUserData {
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
  external_id?: string;
}

export interface CapiOptions {
  user_data?: CapiUserData;
  test_event_code?: string;
}

function readFbCookies(): { fbp?: string; fbc?: string } {
  if (typeof document === "undefined") return {};
  const out: { fbp?: string; fbc?: string } = {};
  for (const part of document.cookie.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === "_fbp") out.fbp = decodeURIComponent(v || "");
    else if (k === "_fbc") out.fbc = decodeURIComponent(v || "");
  }
  return out;
}

export function sendMetaCapiEvent(
  eventName: string,
  eventId: string | null | undefined,
  customData: Record<string, unknown> = {},
  options: CapiOptions = {},
): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/kali_master")) return;

  const { fbp, fbc } = readFbCookies();

  const body = {
    event_name: eventName,
    event_id: eventId || undefined,
    event_time: Math.floor(Date.now() / 1000),
    event_source_url: window.location.href,
    action_source: "website",
    custom_data: customData,
    user_data: {
      ...(options.user_data || {}),
      fbp,
      fbc,
    },
    test_event_code: options.test_event_code,
  };

  // Fire-and-forget; do not await
  supabase.functions.invoke("meta-capi", { body }).catch((err) => {
    // Never break shopper UX on tracking errors
    if (typeof console !== "undefined") console.debug("[meta-capi] failed", err);
  });
}
