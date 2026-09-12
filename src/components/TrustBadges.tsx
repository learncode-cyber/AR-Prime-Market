import { ShieldCheck, Truck, RotateCcw, Headphones } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";

// Free-shipping threshold is defined in USD (global baseline) and converted
// to the visitor's active currency via live FX rates.
export const FREE_SHIPPING_THRESHOLD_USD = 100;

export const TrustBadges = () => {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();

  const thresholdLabel = formatPrice(FREE_SHIPPING_THRESHOLD_USD, "USD");

  const badges = [
    { icon: ShieldCheck, title: "Secure Checkout", desc: "SSL Encrypted" },
    { icon: Truck, title: "Free Shipping", desc: `Orders over ${thresholdLabel}` },
    { icon: RotateCcw, title: "Easy Returns", desc: "30-day policy" },
    { icon: Headphones, title: "24/7 Support", desc: "We're here to help" },
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {badges.map((b, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 sm:p-4 rounded-xl bg-card border border-border"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <b.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-display font-semibold text-[11px] sm:text-xs text-foreground">
                {b.title}
              </h4>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground">{b.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
