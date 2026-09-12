import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductReview {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  review_text: string | null;
  is_approved: boolean;
  created_at: string;
  profile_email?: string;
}

export const useProductReviews = (productId: string) => {
  return useQuery({
    queryKey: ["product-reviews", productId],
    queryFn: async (): Promise<ProductReview[]> => {
      const { data, error } = await supabase
        .from("product_reviews")
        .select("*")
        .eq("product_id", productId)
        .eq("is_approved", true)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[Reviews] Query error:", error.message);
        return [];
      }
      return data || [];
    },
    enabled: !!productId,
  });
};

export const useSubmitReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      product_id,
      user_id,
      rating,
      review_text,
    }: {
      product_id: string;
      user_id: string;
      rating: number;
      review_text: string;
    }) => {
      const { error } = await supabase.from("product_reviews").insert({
        product_id,
        user_id,
        rating,
        review_text,
        is_approved: false,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["product-reviews", vars.product_id] });
    },
  });
};
