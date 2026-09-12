import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PaymentMethod {
  id: string;
  method_key: string;
  display_name: string;
  display_name_bn: string | null;
  icon_name: string | null;
  is_active: boolean;
  instructions: string | null;
  instructions_bn: string | null;
  sort_order: number;
  wallet_address?: string | null;
  deposit_link?: string | null;
}

/**
 * Public-facing payment methods (no secrets). Reads from `payment_methods_public` view.
 * Returns empty list (no error) when the table/view does not yet exist.
 */
export const usePaymentMethods = (activeOnly = true) => {
  return useQuery({
    queryKey: ["payment-methods", activeOnly],
    queryFn: async (): Promise<PaymentMethod[]> => {
      const source = activeOnly ? "payment_methods_public" : "payment_methods";
      const { data, error } = await (supabase as any)
        .from(source)
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) {
        // Table not yet provisioned — caller falls back to hardcoded list.
        console.warn("[usePaymentMethods] table missing or unreadable:", error.message);
        return [];
      }
      return (data || []) as PaymentMethod[];
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useUpdatePaymentMethod = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PaymentMethod> }) => {
      const { error } = await (supabase as any)
        .from("payment_methods")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment-methods"] }),
  });
};

export const useCreatePaymentMethod = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<PaymentMethod>) => {
      const { error } = await (supabase as any).from("payment_methods").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment-methods"] }),
  });
};

export const useDeletePaymentMethod = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("payment_methods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment-methods"] }),
  });
};
