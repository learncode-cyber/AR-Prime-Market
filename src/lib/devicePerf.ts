export type DeviceTier = "fast" | "normal" | "slow" | "reduced";

interface NavConn {
  effectiveType?: string;
  saveData?: boolean;
  addEventListener?: (type: "change", cb: () => void) => void;
  removeEventListener?: (type: "change", cb: () => void) => void;
}

function readConnection(): NavConn {
  if (typeof navigator === "undefined") return {};
  return (navigator as Navigator & { connection?: NavConn }).connection ?? {};
}

export function getDeviceTier(): DeviceTier {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "normal";
  }

  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return "reduced";
    }
  } catch {
    /* ignore */
  }

  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const conn = readConnection();
  const eff = conn.effectiveType ?? "4g";
  const saveData = conn.saveData === true;

  if (saveData || cores <= 4 || mem <= 2 || eff === "slow-2g" || eff === "2g" || eff === "3g") {
    return "slow";
  }
  if (cores >= 8 && mem >= 8 && eff === "4g") {
    return "fast";
  }
  return "normal";
}

export interface SplashTimings {
  minMs: number;
  maxMs: number;
  tier: DeviceTier;
}

export function getSplashTimings(): SplashTimings {
  const tier = getDeviceTier();
  switch (tier) {
    case "reduced":
      return { minMs: 80, maxMs: 8000, tier };
    case "fast":
      return { minMs: 120, maxMs: 8000, tier };
    case "slow":
      return { minMs: 450, maxMs: 12000, tier };
    case "normal":
    default:
      return { minMs: 250, maxMs: 8000, tier };
  }
}

/**
 * Subscribe to network condition changes (effectiveType / saveData).
 * Calls `cb` whenever the underlying `navigator.connection` reports a change.
 * Returns an unsubscribe function. No-op on SSR or unsupported browsers.
 */
export function subscribeToNetworkChanges(cb: () => void): () => void {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return () => {};
  }
  const conn = readConnection();
  if (!conn.addEventListener) return () => {};
  conn.addEventListener("change", cb);
  return () => conn.removeEventListener?.("change", cb);
}
