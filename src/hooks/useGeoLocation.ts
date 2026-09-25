import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GeoData {
  country: string; // ISO-2
  currency: string; // e.g. "AED"
  language: string; // e.g. "ar"
  dial: string; // e.g. "+971"
  source: string;
}

let cached: GeoData | null = null;
let inflight: Promise<GeoData | null> | null = null;

async function fetchGeo(): Promise<GeoData | null> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("get-user-geo", { method: "GET" });
      if (error || !data?.country) return null;
      cached = data as GeoData;
      return cached;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * Returns geo data for the current visitor, or null while loading / on failure.
 * Result is cached in-memory for the session. UI components must keep working
 * if this returns null (safe fallback rule).
 */
export function useGeoLocation(): GeoData | null {
  const [geo, setGeo] = useState<GeoData | null>(cached);

  useEffect(() => {
    if (cached) {
      setGeo(cached);
      return;
    }
    let alive = true;
    fetchGeo().then((g) => {
      if (alive && g) setGeo(g);
    });
    return () => {
      alive = false;
    };
  }, []);

  return geo;
}
