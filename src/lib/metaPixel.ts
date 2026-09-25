// Meta Pixel helper — multi-currency, event_id-ready (CAPI dedupe friendly).
// Reads the active shopper currency from localStorage (set by CurrencyContext).
// All calls are no-ops if fbq isn't loaded yet or we're on an admin path.

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fbq: any;
  }
}

const CURRENCY_STORAGE_KEY = "ar-pm-currency";
const FALLBACK_CURRENCY = "USD";
const ADMIN_PATH_PREFIX = "/kali_master";

export function getActiveCurrency(): string {
  if (typeof window === "undefined") return FALLBACK_CURRENCY;
  try {
    const code = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (code && /^[A-Z]{3}$/.test(code)) return code;
  } catch {
    /* ignore */
  }
  return FALLBACK_CURRENCY;
}

export function generateEventId(prefix = "evt"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

function isAdminPath(): boolean {
  if (typeof window === "undefined") return true;
  return window.location.pathname.startsWith(ADMIN_PATH_PREFIX);
}

export interface MetaEventParams {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

import { sendMetaCapiEvent, type CapiUserData } from "@/lib/metaCapi";

export interface FireMetaEventOptions {
  eventIdPrefix?: string;
  injectCurrency?: boolean;
  /** PII for CAPI (hashed server-side). Never sent to browser Pixel. */
  userData?: CapiUserData;
  /** Set to false to skip CAPI server-side mirror. Default: true. */
  capi?: boolean;
}

/**
 * Fire a Meta Pixel "track" event with auto-generated event_id and active currency,
 * and mirror it to the Conversions API (CAPI) edge function using the same event_id
 * for deduplication. Returns the event_id (or null when skipped).
 */
export function fireMetaEvent(
  eventName: string,
  params: MetaEventParams = {},
  options: FireMetaEventOptions = {},
): string | null {
  if (typeof window === "undefined") return null;
  if (isAdminPath()) return null;

  const eventId = generateEventId(options.eventIdPrefix ?? eventName.toLowerCase());
  const enriched: MetaEventParams = { ...params, event_id: eventId };
  if (options.injectCurrency !== false && enriched.currency == null) {
    enriched.currency = getActiveCurrency();
  }

  if (window.fbq) {
    try {
      window.fbq("track", eventName, enriched, { eventID: eventId });
    } catch {
      /* swallow — never break shopper flow on tracking errors */
    }
  }

  // Server-side CAPI mirror with same event_id for deduplication
  if (options.capi !== false) {
    // Strip event_id from custom_data (Meta uses top-level event_id)
    const { event_id: _omit, ...customData } = enriched;
    sendMetaCapiEvent(eventName, eventId, customData, { user_data: options.userData });
  }

  return eventId;
}

export function fireMetaPageView(): string | null {
  return fireMetaEvent("PageView", {}, { eventIdPrefix: "pv", injectCurrency: false });
}
