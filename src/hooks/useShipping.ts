import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ShippingRate {
  id: string;
  zone_name: string;
  shipping_type: string; // 'standard' | 'express' | 'inside_dhaka' | 'outside_dhaka'
  base_cost: number;
  per_kg_cost: number;
  min_days: number;
  max_days: number;
  is_active: boolean;
}

export interface ShippingOption {
  rate: ShippingRate;
  totalCost: number;
  estimatedDays: string;
}

const ZONE_MATCHER: Record<string, RegExp> = {
  "Dhaka City": /dhaka/i,
  "Outside Dhaka": /(chittagong|sylhet|khulna|rajshahi|barishal|rangpur|mymensingh)/i,
};

/**
 * Reads shipping rates from `shipping_rates`. Returns empty list (not error)
 * if the table doesn't exist yet — checkout falls back to free shipping.
 */
export function useShippingRates() {
  return useQuery({
    queryKey: ["shipping-rates"],
    queryFn: async (): Promise<ShippingRate[]> => {
      const { data, error } = await (supabase as any)
        .from("shipping_rates")
        .select("*")
        .eq("is_active", true);
      if (error) {
        console.warn("[useShippingRates] table missing:", error.message);
        return [];
      }
      return (data || []) as ShippingRate[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Hook used in checkout: picks rates for the destination city, exposes selection.
 */
export function useShipping(city: string, subtotal: number, totalWeightKg = 0.5) {
  const { data: allRates = [], isLoading } = useShippingRates();
  const [selectedType, setSelectedType] = useState<string>("");

  const zoneName = useMemo(() => {
    if (!city) return "Outside Dhaka";
    for (const [name, regex] of Object.entries(ZONE_MATCHER)) {
      if (regex.test(city)) return name;
    }
    return "International";
  }, [city]);

  const zoneRates = useMemo(
    () => allRates.filter((r) => r.zone_name === zoneName),
    [allRates, zoneName],
  );

  const options: ShippingOption[] = useMemo(
    () =>
      zoneRates.map((rate) => ({
        rate,
        totalCost: Number(rate.base_cost) + Number(rate.per_kg_cost) * totalWeightKg,
        estimatedDays: `${rate.min_days}-${rate.max_days}`,
      })),
    [zoneRates, totalWeightKg],
  );

  useEffect(() => {
    if (options.length === 0) return;
    if (!options.some((o) => o.rate.shipping_type === selectedType)) {
      setSelectedType(options[0].rate.shipping_type);
    }
  }, [options, selectedType]);

  const selected = options.find((o) => o.rate.shipping_type === selectedType) || options[0];

  return {
    options,
    selected,
    selectedType,
    setSelectedType,
    loading: isLoading,
    zoneName,
    hasRates: allRates.length > 0,
  };
}

// Admin CRUD
export function useUpsertShippingRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<ShippingRate> & { id?: string }) => {
      const { id, ...rest } = payload;
      if (id) {
        const { error } = await (supabase as any).from("shipping_rates").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("shipping_rates").insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shipping-rates"] }),
  });
}

export function useDeleteShippingRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("shipping_rates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shipping-rates"] }),
  });
}
