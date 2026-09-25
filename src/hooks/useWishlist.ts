import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export function useWishlistStatus(productId: string) {
  const { user } = useAuth();

  const { data: isInWishlist = false } = useQuery({
    queryKey: ["wishlist-check", user?.id, productId],
    enabled: !!user && !!productId,
    queryFn: async () => {
      const { data } = await supabase
        .from("wishlists")
        .select("id")
        .eq("user_id", user!.id)
        .eq("product_id", productId)
        .maybeSingle();
      return !!data;
    },
  });

  return isInWishlist;
}

export function useToggleWishlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      if (!user) throw new Error("Login required");

      const { data: existing } = await supabase
        .from("wishlists")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", productId)
        .maybeSingle();

      if (existing) {
        await supabase.from("wishlists").delete().eq("id", existing.id);
        return { added: false };
      } else {
        await supabase.from("wishlists").insert({ user_id: user.id, product_id: productId });
        return { added: true };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      queryClient.invalidateQueries({ queryKey: ["wishlist-check"] });
      toast.success(result.added ? "Added to wishlist" : "Removed from wishlist");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update wishlist");
    },
  });
}
