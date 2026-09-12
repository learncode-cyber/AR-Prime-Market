import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShoppingBag, ExternalLink, Minus, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyContext";
import { toast } from "sonner";
import type { Product } from "@/hooks/useProductData";

interface Props {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}

export const ProductQuickViewDialog = ({ product, open, onClose }: Props) => {
  const { addToCart } = useCart();
  const { formatPrice } = useCurrency();
  const [qty, setQty] = useState(1);
  const [activeIdx, setActiveIdx] = useState(0);

  if (!product) return null;

  const images = (product.images?.length ? product.images : [product.image]).slice(0, 5);
  const discount = product.compare_at_price
    ? Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100)
    : 0;

  const handleAdd = () => {
    for (let i = 0; i < qty; i++) addToCart(product);
    toast.success(`${product.title} added to cart`);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="line-clamp-2 pr-8">{product.title}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="relative aspect-square overflow-hidden rounded-xl bg-secondary/30">
              <img
                src={images[activeIdx]}
                alt={product.title}
                className="w-full h-full object-cover"
              />
              {discount > 0 && (
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-destructive text-destructive-foreground text-xs font-bold">
                  -{discount}%
                </span>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIdx(i)}
                    className={`w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 ${
                      i === activeIdx ? "border-primary" : "border-transparent"
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              <span className="font-display font-bold text-2xl text-foreground">
                {formatPrice(product.price, product.currency)}
              </span>
              {product.compare_at_price && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatPrice(product.compare_at_price, product.currency)}
                </span>
              )}
            </div>

            <p className="text-sm text-muted-foreground mt-3 line-clamp-5">
              {product.description || "No description available."}
            </p>

            <div className="text-xs text-muted-foreground mt-3">
              {product.stock_quantity > 0 ? (
                <span className="text-emerald-600">In stock ({product.stock_quantity})</span>
              ) : (
                <span className="text-red-500">Out of stock</span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-4">
              <span className="text-sm text-muted-foreground">Qty</span>
              <div className="flex items-center border border-border rounded-lg">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="p-2 hover:bg-secondary transition-colors"
                  aria-label="Decrease"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="px-3 text-sm font-medium min-w-[2rem] text-center">{qty}</span>
                <button
                  onClick={() => setQty((q) => Math.min(product.stock_quantity || 99, q + 1))}
                  className="p-2 hover:bg-secondary transition-colors"
                  aria-label="Increase"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mt-5">
              <Button
                onClick={handleAdd}
                disabled={product.stock_quantity === 0}
                className="flex-1"
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                Add to Cart
              </Button>
              <Button variant="outline" asChild>
                <Link to="/products/$slug" params={{ slug: product.slug }} onClick={onClose}>
                  Details
                  <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
