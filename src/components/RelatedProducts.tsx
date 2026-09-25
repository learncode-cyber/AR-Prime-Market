import { Link } from "@tanstack/react-router";
import { ShoppingBag, Star } from "lucide-react";
import { useProductList } from "@/hooks/useProductData";
import { useCart } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyContext";
import { toast } from "sonner";

interface RelatedProductsProps {
  productId: string;
  categoryId?: string | null;
}

export const RelatedProducts = ({ productId, categoryId }: RelatedProductsProps) => {
  const { data: allProducts = [] } = useProductList({ limit: 20, sort: "rating" });
  const { addToCart } = useCart();
  const { formatPrice } = useCurrency();

  const related = allProducts
    .filter((p) => p.id !== productId && (categoryId ? p.category_id === categoryId : true))
    .slice(0, 6);

  if (related.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h2 className="font-display font-bold text-lg sm:text-xl text-foreground mb-4">
        You May Also Like
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {related.map((product) => (
          <Link
            key={product.id}
            to="/products/$slug"
            params={{ slug: product.slug }}
            className="group rounded-md border border-border bg-card overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="aspect-square overflow-hidden bg-secondary/30">
              <img
                src={product.image}
                alt={product.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            </div>
            <div className="p-2.5">
              <h3 className="text-xs font-medium text-foreground line-clamp-2">{product.title}</h3>
              <div className="flex items-center gap-1 mt-1">
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                <span className="text-[10px] text-muted-foreground">{product.rating}</span>
              </div>
              <p className="font-display font-bold text-xs text-foreground mt-1">
                {formatPrice(product.price, product.currency)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};
