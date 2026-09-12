import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Schema matches the existing `product_variants` table in this project:
//   name (e.g. "Size", "Color"), value (e.g. "M", "Red"),
//   additional_price, stock_quantity, sku
export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  value: string;
  additional_price: number;
  stock_quantity: number;
  sku: string | null;
}

export const useProductVariants = (productId: string | undefined) => {
  return useQuery({
    queryKey: ["product-variants", productId],
    queryFn: async (): Promise<ProductVariant[]> => {
      if (!productId) return [];
      const { data, error } = await supabase
        .from("product_variants")
        .select("id, product_id, name, value, additional_price, stock_quantity, sku")
        .eq("product_id", productId);
      if (error) {
        console.warn("[useProductVariants]", error.message);
        return [];
      }
      return (data || []).map((v) => ({
        id: v.id,
        product_id: v.product_id ?? productId,
        name: v.name,
        value: v.value,
        additional_price: Number(v.additional_price ?? 0),
        stock_quantity: Number(v.stock_quantity ?? 0),
        sku: v.sku ?? null,
      }));
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });
};
