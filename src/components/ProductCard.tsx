import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShoppingBag, Star, Zap, Eye } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useLanguage } from "@/context/LanguageContext";
import { WishlistButton } from "./WishlistButton";
import { QuickCheckoutModal } from "./QuickCheckoutModal";
import { toast } from "sonner";
import type { Product } from "@/hooks/useProductData";

interface ProductCardProps {
  product: Product;
  onQuickView?: (product: Product) => void;
}

export const ProductCard = ({ product, onQuickView }: ProductCardProps) => {
  const [quickOpen, setQuickOpen] = useState(false);
  const { addToCart } = useCart();
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();

  const discount = product.compare_at_price
    ? Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100)
    : 0;

  return (
    <div className="group h-full rounded-md border border-border bg-card overflow-hidden card-hover flex flex-col">
      <Link to="/products/$slug" params={{ slug: product.slug }} className="block">
        <div className="relative aspect-square overflow-hidden bg-secondary/30 rounded-t-md">
          <img
            src={product.image || "/placeholder.svg"}
            alt={product.title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={(e) => {
              const t = e.currentTarget;
              if (!t.src.endsWith("/placeholder.svg")) t.src = "/placeholder.svg";
            }}
          />
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {discount > 0 && (
              <span className="px-1.5 py-0.5 rounded-sm bg-destructive text-destructive-foreground text-[9px] sm:text-[10px] font-bold">
                -{discount}%
              </span>
            )}
          </div>
          <div className="absolute top-2 right-2 flex flex-col gap-1.5">
            <WishlistButton
              productId={product.id}
              className="bg-card/80 backdrop-blur-sm rounded-md"
            />
            {onQuickView && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onQuickView(product);
                }}
                aria-label="Quick view"
                title="Quick view"
                className="p-1.5 rounded-md bg-card/80 backdrop-blur-sm text-foreground hover:bg-card transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </Link>
      <div className="p-2.5 sm:p-3.5 flex flex-col flex-1">
        <Link to="/products/$slug" params={{ slug: product.slug }}>
          <h3 className="font-display font-semibold text-[11px] sm:text-sm text-foreground line-clamp-2 hover:text-primary transition-colors leading-snug min-h-[2.4em] sm:min-h-[2.6em]">
            {product.title}
          </h3>
        </Link>

        <div className="flex items-center gap-0.5 mt-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${i < Math.floor(product.rating) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/15"}`}
            />
          ))}
          <span className="text-[9px] sm:text-[10px] text-muted-foreground ml-0.5">
            ({product.review_count})
          </span>
        </div>

        <div className="flex items-center justify-between mt-auto pt-1.5 gap-2">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="font-display font-bold text-sm sm:text-base text-foreground">
              {formatPrice(product.price, product.currency)}
            </span>
            {product.compare_at_price && (
              <span className="text-[10px] sm:text-xs text-muted-foreground line-through truncate">
                {formatPrice(product.compare_at_price, product.currency)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setQuickOpen(true);
              }}
              className="p-2 sm:p-2.5 rounded-md bg-gradient-to-br from-amber-400 to-orange-500 text-white active:scale-90 transition-all touch-manipulation shadow-[0_0_12px_-3px_rgba(251,146,60,0.6)] hover:shadow-[0_0_18px_-3px_rgba(251,146,60,0.85)]"
              aria-label="1-Click Order"
              title="1-Click Buy Now"
            >
              <Zap className="w-3.5 h-3.5 fill-white" />
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                addToCart(product);
                toast.success(`${product.title} added to cart`);
              }}
              className="p-2 sm:p-2.5 rounded-md bg-primary text-primary-foreground active:scale-90 transition-all touch-manipulation hover:brightness-110"
              aria-label={t("addToCart")}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      <QuickCheckoutModal product={product} open={quickOpen} onClose={() => setQuickOpen(false)} />
    </div>
  );
};
