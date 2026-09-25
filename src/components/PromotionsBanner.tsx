import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Tag, ChevronLeft, ChevronRight, Copy, CheckCircle, ShoppingCart } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";

interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order_amount: number | null;
  expires_at: string | null;
}

const PromotionsBanner = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { lang } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOffers = async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("coupons")
        .select("id, code, discount_type, discount_value, min_order_amount, expires_at")
        .eq("is_active", true)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .limit(5);
      if (data) setCoupons(data as Coupon[]);
      setLoading(false);
    };
    fetchOffers();
  }, []);

  useEffect(() => {
    if (coupons.length <= 1) return;
    const timer = setInterval(() => setCurrent((prev) => (prev + 1) % coupons.length), 5000);
    return () => clearInterval(timer);
  }, [coupons.length]);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const applyToCart = (code: string) => {
    navigate({ to: "/cart", search: { coupon: code } as any });
  };

  if (loading) {
    return (
      <section
        aria-label="Loading promotional offers"
        className="max-w-7xl mx-auto px-4 sm:px-6 py-3"
      >
        <div className="w-full">
          <div className="relative bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 border border-primary/20 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-2 py-2.5 sm:gap-4 sm:px-6 sm:py-4">
              <Skeleton className="w-8 h-8 sm:w-10 sm:h-10 rounded-full shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <Skeleton className="h-3 sm:h-4 w-3/4" />
                <Skeleton className="h-2 sm:h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 sm:h-7 w-16 sm:w-20 rounded-lg sm:rounded-xl shrink-0" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (coupons.length === 0) return null;

  const offer = coupons[current % coupons.length];
  const discount =
    offer.discount_type === "percentage" ? `${offer.discount_value}%` : `৳${offer.discount_value}`;

  return (
    <section aria-label="Promotional offers" className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
      <div className="w-full">
        <div className="relative bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 border border-primary/20 rounded-2xl overflow-hidden">
          <div className="relative flex items-center justify-between gap-1 px-2 py-2.5 sm:gap-2 sm:px-6 sm:py-4 min-w-0">
            {coupons.length > 1 && (
              <button
                onClick={() => setCurrent((prev) => (prev - 1 + coupons.length) % coupons.length)}
                className="p-1.5 rounded-full hover:bg-primary/10 transition-colors shrink-0 touch-manipulation"
              >
                <ChevronLeft className="w-4 h-4 text-primary" />
              </button>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={offer.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="flex-1 flex items-center justify-center gap-2 sm:gap-4 min-w-0"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Tag className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <div className="flex items-center gap-1.5 justify-center sm:justify-start flex-wrap">
                    <span className="font-display font-bold text-xs sm:text-base text-foreground whitespace-nowrap">
                      {discount} OFF
                    </span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground truncate">
                      Code: {offer.code}
                    </span>
                  </div>
                  {offer.min_order_amount && (
                    <p className="text-[9px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                      Min order ৳{offer.min_order_amount}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => copyCode(offer.code!)}
                    className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg bg-secondary text-foreground text-[10px] sm:text-xs font-semibold hover:bg-secondary/80 active:scale-95 transition-all touch-manipulation"
                    title="Copy code"
                  >
                    {copiedCode === offer.code ? (
                      <CheckCircle className="w-3 h-3 shrink-0" />
                    ) : (
                      <Copy className="w-3 h-3 shrink-0" />
                    )}
                    <span className="truncate">
                      {copiedCode === offer.code ? "Copied" : "Copy"}
                    </span>
                  </button>
                  <button
                    onClick={() => applyToCart(offer.code!)}
                    className="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-primary text-primary-foreground text-[10px] sm:text-xs font-semibold hover:brightness-105 active:scale-95 transition-all touch-manipulation"
                    title="Apply to cart"
                  >
                    <ShoppingCart className="w-3 h-3 shrink-0" />
                    <span className="truncate">Apply</span>
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>

            {coupons.length > 1 && (
              <button
                onClick={() => setCurrent((prev) => (prev + 1) % coupons.length)}
                className="p-1.5 rounded-full hover:bg-primary/10 transition-colors shrink-0 touch-manipulation"
              >
                <ChevronRight className="w-4 h-4 text-primary" />
              </button>
            )}
          </div>

          {coupons.length > 1 && (
            <div className="flex justify-center gap-1 pb-2">
              {coupons.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === current % coupons.length ? "bg-primary" : "bg-primary/20"}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default PromotionsBanner;
