import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { Minus, Plus, Trash2, ShoppingBag, Tag, X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useCoupon } from "@/hooks/useCoupon";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Cart — AR Prime Market" },
      { name: "description", content: "Review your shopping cart." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { coupon?: string } => ({
    ...(typeof search.coupon === "string" ? { coupon: search.coupon } : {}),
  }),
  component: CartPage,
});

function CartPage() {
  const { items, updateQuantity, removeFromCart, totalItems, subtotal } = useCart();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const {
    couponCode,
    setCouponCode,
    appliedCoupon,
    loading: couponLoading,
    applyCoupon,
    removeCoupon,
    discountAmount,
    finalTotal,
  } = useCoupon(subtotal);

  const search = useSearch({ from: "/cart" });

  useEffect(() => {
    if (search.coupon && typeof search.coupon === "string" && !appliedCoupon) {
      setCouponCode(search.coupon.toUpperCase());
      // small delay to allow state update before apply
      const timer = setTimeout(() => applyCoupon(), 0);
      return () => clearTimeout(timer);
    }
  }, [search.coupon]);

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <ShoppingBag className="w-16 h-16 text-muted-foreground/20 mb-4" />
        <h2 className="font-display font-bold text-xl text-foreground">{t("emptyCart")}</h2>
        <Link
          to="/products"
          className="mt-4 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all"
        >
          {t("continueShopping")}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="font-display font-bold text-xl sm:text-2xl text-foreground mb-1">
        {t("cart")}
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        {totalItems} {t("itemsInCart")}
      </p>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Items */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => {
            const unitPrice = item.product.price + (item.priceDelta || 0);
            return (
              <div
                key={`${item.product.id}-${item.variantId || "base"}`}
                className="flex gap-4 p-4 rounded-2xl border border-border bg-card"
              >
                <img
                  src={item.product.image}
                  alt={item.product.title}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold text-sm text-foreground truncate">
                    {item.product.title}
                  </h3>
                  {item.variantLabel && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.variantLabel}</p>
                  )}
                  <p className="font-display font-bold text-sm text-foreground mt-1">
                    {formatPrice(unitPrice, item.product.currency)}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center border border-border rounded-lg overflow-hidden">
                      <button
                        onClick={() =>
                          updateQuantity(item.product.id, item.quantity - 1, item.variantId)
                        }
                        className="px-2 py-1.5 hover:bg-secondary transition-colors touch-manipulation"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-3 py-1.5 text-xs font-medium">{item.quantity}</span>
                      <button
                        onClick={() =>
                          updateQuantity(item.product.id, item.quantity + 1, item.variantId)
                        }
                        className="px-2 py-1.5 hover:bg-secondary transition-colors touch-manipulation"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product.id, item.variantId)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors touch-manipulation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display font-bold text-sm text-foreground">
                    {formatPrice(unitPrice * item.quantity, item.product.currency)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-border bg-card p-5 sticky top-20">
            <h3 className="font-display font-bold text-base text-foreground mb-4">
              {t("orderSummary")}
            </h3>

            {/* Coupon */}
            <div className="mb-4">
              {appliedCoupon ? (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                      {appliedCoupon.code}
                    </span>
                  </div>
                  <button
                    onClick={removeCoupon}
                    className="p-1 text-green-600 hover:text-destructive transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Coupon code"
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    onClick={applyCoupon}
                    disabled={couponLoading || !couponCode.trim()}
                    className="px-3 py-2 rounded-lg bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80 transition-colors disabled:opacity-50"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("subtotal")}</span>
                <span className="font-medium text-foreground">{formatPrice(subtotal, "USD")}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span className="font-medium">-{formatPrice(discountAmount, "USD")}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("shipping")}</span>
                <span className="font-medium text-green-600">{t("free")}</span>
              </div>
              <div className="border-t border-border pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="font-display font-bold text-foreground">{t("total")}</span>
                  <span className="font-display font-bold text-foreground">
                    {formatPrice(finalTotal, "USD")}
                  </span>
                </div>
              </div>
            </div>
            <Link
              to="/checkout"
              className="mt-4 block w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold text-center hover:brightness-110 transition-all active:scale-[0.98] touch-manipulation"
            >
              {t("checkout")}
            </Link>
            <Link
              to="/products"
              className="mt-2 block text-center text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              {t("continueShopping")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
