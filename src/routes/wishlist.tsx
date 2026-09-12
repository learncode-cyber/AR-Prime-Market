import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useLanguage } from "@/context/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FeatureGate } from "@/components/FeatureGate";

export const Route = createFileRoute("/wishlist")({
  head: () => ({
    meta: [
      { title: "Wishlist — AR Prime Market" },
      { name: "description", content: "Your saved products." },
    ],
  }),
  component: () => (
    <FeatureGate flag="wishlist">
      <WishlistPage />
    </FeatureGate>
  ),
});

function WishlistPage() {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const { data: wishlistItems = [], isLoading } = useQuery({
    queryKey: ["wishlist", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishlists")
        .select(
          "id, product_id, products(id, title, slug, price, compare_at_price, currency, gallery_urls, stock_quantity, is_active)",
        )
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data || []).map((w: any) => ({
        wishlistId: w.id,
        product: {
          id: w.products.id,
          title: w.products.title,
          slug: w.products.slug,
          price: w.products.price,
          compare_at_price: w.products.compare_at_price,
          image: w.products.gallery_urls?.[0] || "/placeholder.svg",
          images: w.products.gallery_urls || [],
          stock_quantity: w.products.stock_quantity,
          is_active: w.products.is_active,
          category: "",
          category_id: null,
          description: "",
          currency: w.products.currency || "USD",
          sku: null,
          rating: 0,
          review_count: 0,
        },
      }));
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (wishlistId: string) => {
      const { error } = await supabase.from("wishlists").delete().eq("id", wishlistId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      toast.success("Removed from wishlist");
    },
  });

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <Heart className="w-16 h-16 text-muted-foreground/20 mb-4" />
        <h2 className="font-display font-bold text-xl text-foreground">
          Login to view your wishlist
        </h2>
        <Link
          to="/login"
          className="mt-4 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all"
        >
          Login
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display font-bold text-2xl text-foreground mb-6">My Wishlist</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4 animate-pulse">
              <div className="aspect-square rounded-xl bg-secondary/50 mb-3" />
              <div className="h-4 bg-secondary/50 rounded mb-2" />
              <div className="h-3 bg-secondary/30 rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="font-display font-bold text-2xl text-foreground mb-1">My Wishlist</h1>
      <p className="text-sm text-muted-foreground mb-6">{wishlistItems.length} saved items</p>

      {wishlistItems.length === 0 ? (
        <div className="text-center py-16">
          <Heart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Your wishlist is empty</p>
          <Link to="/products" className="mt-4 inline-block text-primary hover:underline text-sm">
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {wishlistItems.map((item) => (
            <div
              key={item.wishlistId}
              className="group rounded-2xl border border-border bg-card overflow-hidden"
            >
              <Link to="/products/$slug" params={{ slug: item.product.slug }}>
                <div className="aspect-square overflow-hidden bg-secondary/30 relative">
                  <img
                    src={item.product.image}
                    alt={item.product.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      removeMutation.mutate(item.wishlistId);
                    }}
                    className="absolute top-2 right-2 p-2 rounded-full bg-background/80 backdrop-blur-sm text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Link>
              <div className="p-3 sm:p-4">
                <Link to="/products/$slug" params={{ slug: item.product.slug }}>
                  <h3 className="font-display font-semibold text-sm text-foreground line-clamp-2 hover:text-primary transition-colors">
                    {item.product.title}
                  </h3>
                </Link>
                <div className="flex items-center gap-2 mt-2">
                  <span className="font-display font-bold text-sm text-foreground">
                    {formatPrice(item.product.price, item.product.currency)}
                  </span>
                  {item.product.compare_at_price && (
                    <span className="text-xs text-muted-foreground line-through">
                      {formatPrice(item.product.compare_at_price, item.product.currency)}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    addToCart(item.product);
                    toast.success(`${item.product.title} added to cart`);
                  }}
                  disabled={item.product.stock_quantity <= 0}
                  className="mt-2.5 w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-50 touch-manipulation flex items-center justify-center gap-1.5"
                >
                  <ShoppingCart className="w-3.5 h-3.5" /> {t("addToCart")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
