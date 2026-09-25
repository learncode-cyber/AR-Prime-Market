import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Minus, ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useLanguage } from "@/context/LanguageContext";
import { Link } from "@tanstack/react-router";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

export const CartDrawer = ({ open, onClose }: CartDrawerProps) => {
  const { items, updateQuantity, removeFromCart, subtotal, totalItems } = useCart();
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:max-w-md z-50 bg-background border-l border-border flex flex-col"
          >
            <div className="flex items-center justify-between px-4 sm:px-6 h-14 sm:h-16 border-b border-border">
              <h2 className="font-display font-semibold text-sm sm:text-base text-foreground flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                {t("cart")} ({totalItems})
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-secondary transition-colors touch-manipulation"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <ShoppingBag className="w-12 h-12 text-muted-foreground/20 mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">{t("emptyCart")}</p>
                  <Link
                    to="/products"
                    onClick={onClose}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm touch-manipulation"
                  >
                    {t("continueShopping")} <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                items.map((item) => (
                  <motion.div
                    key={`${item.product.id}-${item.variantId}`}
                    layout
                    className="flex gap-3 p-3 rounded-xl bg-card border border-border"
                  >
                    <img
                      src={item.product.image}
                      alt={item.product.title}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-xs text-foreground truncate">
                        {item.product.title}
                      </h4>
                      {item.variantLabel && (
                        <p className="text-[10px] text-muted-foreground">{item.variantLabel}</p>
                      )}
                      <p className="text-sm text-primary font-semibold mt-0.5">
                        {formatPrice(
                          item.product.price + (item.priceDelta || 0),
                          item.product.currency,
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <button
                          onClick={() =>
                            updateQuantity(item.product.id, item.quantity - 1, item.variantId)
                          }
                          className="p-1.5 rounded-md bg-secondary hover:bg-border transition-colors touch-manipulation active:scale-90"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-medium w-5 text-center">{item.quantity}</span>
                        <button
                          onClick={() =>
                            updateQuantity(item.product.id, item.quantity + 1, item.variantId)
                          }
                          className="p-1.5 rounded-md bg-secondary hover:bg-border transition-colors touch-manipulation active:scale-90"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product.id, item.variantId)}
                      className="self-start p-1.5 rounded-md hover:bg-destructive/10 transition-colors touch-manipulation"
                    >
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </motion.div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="p-4 sm:p-6 border-t border-border space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("subtotal")}</span>
                  <span className="font-display font-bold text-foreground text-base">
                    {formatPrice(subtotal, "USD")}
                  </span>
                </div>
                <Link
                  to="/cart"
                  onClick={onClose}
                  className="block w-full text-center px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm transition-all hover:brightness-105 active:scale-[0.98] touch-manipulation"
                >
                  {t("viewCart")}
                </Link>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
