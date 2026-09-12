import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Supplier {
  id: string;
  name: string;
  provider: string; // 'cj' | 'aliexpress' | 'spocket' | 'custom'
  api_endpoint: string | null;
  api_key_ref: string | null; // references integration_secrets.provider
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
}

export const useSuppliers = () => {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: async (): Promise<Supplier[]> => {
      const { data, error } = await (supabase as any)
        .from("suppliers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.warn("[useSuppliers] table missing:", error.message);
        return [];
      }
      return (data || []) as Supplier[];
    },
    staleTime: 60 * 1000,
  });
};

export const useUpsertSupplier = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Supplier> & { id?: string }) => {
      const { id, ...rest } = payload;
      if (id) {
        const { error } = await (supabase as any).from("suppliers").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("suppliers").insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });
};

export const useDeleteSupplier = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });
};

/** Trigger supplier-sync edge function (Phase 8). Safe no-op if function missing. */
export const useSyncSupplier = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (supplierId: string) => {
      const { data, error } = await supabase.functions.invoke("supplier-sync", {
        body: { supplier_id: supplierId },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });
};
