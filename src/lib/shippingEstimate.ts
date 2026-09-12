// Frontend-only shipping cost & delivery window estimator.
// Updates live as the user changes country / state / postal.
// All amounts returned in the destination currency from addressConfig.

import { getAddressConfig } from "@/config/addressConfig";

export interface ShippingEstimate {
  cost: number;
  currency: string;
  minDays: number;
  maxDays: number;
  zoneLabel: string;
  freeShippingThreshold: number | null;
  isFree: boolean;
}

// Broad zones tied to delivery network reality.
type Zone = "domestic_metro" | "domestic_remote" | "gcc" | "intl_near" | "intl_far";

const ZONE_RATES: Record<Zone, { base: number; min: number; max: number; label: string }> = {
  domestic_metro: { base: 2.99, min: 1, max: 3, label: "Metro delivery" },
  domestic_remote: { base: 4.99, min: 3, max: 6, label: "Regional delivery" },
  gcc: { base: 5.99, min: 3, max: 7, label: "GCC express" },
  intl_near: { base: 9.99, min: 7, max: 12, label: "International standard" },
  intl_far: { base: 14.99, min: 10, max: 18, label: "International extended" },
};

// Country → default zone classification.
const COUNTRY_ZONE: Record<string, Zone> = {
  AE: "domestic_metro",
  SA: "gcc",
  QA: "gcc",
  KW: "gcc",
  BH: "gcc",
  OM: "gcc",
  BD: "domestic_metro",
  IN: "intl_near",
  PK: "intl_near",
  LK: "intl_near",
  NP: "intl_near",
  US: "intl_far",
  CA: "intl_far",
  GB: "intl_far",
  AU: "intl_far",
  NZ: "intl_far",
  DE: "intl_far",
  FR: "intl_far",
  IT: "intl_far",
  ES: "intl_far",
  NL: "intl_far",
};

// Bangladesh: Dhaka = metro, others = remote.
function bdZone(state: string, city: string): Zone {
  const t = `${state} ${city}`.toLowerCase();
  return /dhaka/.test(t) ? "domestic_metro" : "domestic_remote";
}

// UAE: Dubai/Abu Dhabi/Sharjah = metro, others = remote.
function aeZone(state: string): Zone {
  const s = state.toLowerCase();
  if (/dubai|abu dhabi|sharjah/.test(s)) return "domestic_metro";
  if (s) return "domestic_remote";
  return "domestic_metro";
}

// Rough postal-code remoteness boost: longer/edge postcodes add 1 day + small surcharge.
function postalSurcharge(
  country: string,
  postal: string,
): { extraCost: number; extraDays: number } {
  if (!postal) return { extraCost: 0, extraDays: 0 };
  const p = postal.trim();
  // Generic heuristic — postal starting with 9 or containing rural prefixes adds a touch.
  if (country === "AU" && /^(0[8-9]|68|69|72|73)/.test(p)) return { extraCost: 2, extraDays: 2 };
  if (country === "CA" && /^[XYT]/i.test(p)) return { extraCost: 3, extraDays: 3 };
  if (country === "US" && /^(9[6-9]|99)/.test(p)) return { extraCost: 3, extraDays: 2 };
  if (country === "SA" && /^[3-4]/.test(p)) return { extraCost: 1, extraDays: 1 };
  return { extraCost: 0, extraDays: 0 };
}

export function estimateShipping(params: {
  country: string;
  state: string;
  city: string;
  postal: string;
  subtotal: number;
}): ShippingEstimate {
  const { country, state, city, postal, subtotal } = params;
  const cfg = getAddressConfig(country);

  let zone: Zone;
  if (country === "BD") zone = bdZone(state, city);
  else if (country === "AE") zone = aeZone(state);
  else zone = COUNTRY_ZONE[country] || "intl_far";

  const base = ZONE_RATES[zone];
  const surcharge = postalSurcharge(country, postal);

  // Free shipping threshold (in destination currency-ish; we keep generic 50).
  const threshold = zone === "domestic_metro" || zone === "domestic_remote" ? 50 : 75;
  const rawCost = base.base + surcharge.extraCost;
  const isFree = subtotal >= threshold;

  return {
    cost: isFree ? 0 : Number(rawCost.toFixed(2)),
    currency: cfg.currency,
    minDays: base.min + surcharge.extraDays,
    maxDays: base.max + surcharge.extraDays,
    zoneLabel: base.label,
    freeShippingThreshold: threshold,
    isFree,
  };
}
