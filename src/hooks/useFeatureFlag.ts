import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FeatureFlagMap = Record<string, boolean>;

async function fetchFlagsViaClient(): Promise<FeatureFlagMap> {
  const { data, error } = await supabase.from("feature_flags").select("key, is_enabled");
  if (error) {
    console.error("fetchFlagsViaClient:", error);
    return {};
  }
  const map: FeatureFlagMap = {};
  for (const row of data ?? []) {
    map[(row as any).key] = !!(row as any).is_enabled;
  }
  return map;
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: ["feature-flags"],
    queryFn: fetchFlagsViaClient,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Returns true when the flag is explicitly enabled, OR when flags are still
 * loading (optimistic — features default to visible to avoid layout flash).
 * If the flag does not exist in DB, defaults to `defaultValue` (true).
 */
export function useFeatureFlag(key: string, defaultValue = true): boolean {
  const { data, isLoading } = useFeatureFlags();
  if (isLoading || !data) return defaultValue;
  if (!(key in data)) return defaultValue;
  return data[key];
}
