import { useState } from "react";
import { Check, Gift, Zap } from "lucide-react";
import { useCurrency } from "@/context/CurrencyContext";
import { cn } from "@/lib/utils";

/**
 * Tiered bundle offer picker (Buy 1 / Buy 2 / Buy 3) shown on every product
 * page. Uses the site's existing design tokens (primary / muted / border) so
 * the website's color scheme is preserved. Auto-applies to every product —
 * including dropshipped ones — since it derives entirely from product price.
 */

export type BundleTier = {
  qty: number;
  /** Extra discount on top of the current sale price (0–1). */
  extraDiscount: number;
  perk?: string;
  popular?: boolean;
};

const DEFAULT_TIERS: BundleTier[] = [
  { qty: 1, extraDiscount: 0 },
  { qty: 2, extraDiscount: 0.1, perk: "Free Rush Delivery", popular: true },
  { qty: 3, extraDiscount: 0.15, perk: "Free Rush Delivery + Gift" },
];

interface Props {
  unitPrice: number;
  unitCompareAt?: number | null;
  selectedQty: number;
  onSelect: (qty: number) => void;
  tiers?: BundleTier[];
  currency?: string;
}

export function BundleOfferPicker({
  unitPrice,
  unitCompareAt,
  selectedQty,
  onSelect,
  tiers = DEFAULT_TIERS,
  currency,
}: Props) {
  const { formatPrice } = useCurrency();
  const baseline = unitCompareAt && unitCompareAt > unitPrice ? unitCompareAt : unitPrice;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-bold tracking-widest text-foreground uppercase flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-primary" />
          Limited Time: Today's Offer
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* Tier list */}
      <div className="space-y-2.5">
        {tiers.map((tier) => {
          const bundleUnit = unitPrice * (1 - tier.extraDiscount);
          const bundleTotal = bundleUnit * tier.qty;
          const baselineTotal = baseline * tier.qty;
          const savings = Math.max(0, baselineTotal - bundleTotal);
          const isSelected = selectedQty === tier.qty;

          return (
            <button
              key={tier.qty}
              type="button"
              onClick={() => onSelect(tier.qty)}
              className={cn(
                "relative w-full text-left rounded-xl border-2 px-4 py-3 transition-all touch-manipulation",
                "active:scale-[0.99]",
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              {tier.popular && (
                <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-foreground text-background text-[10px] font-bold uppercase tracking-wide">
                  Most Popular
                </span>
              )}

              <div className="flex items-center gap-3">
                {/* Radio */}
                <span
                  className={cn(
                    "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                    isSelected ? "border-primary bg-primary" : "border-muted-foreground/40",
                  )}
                >
                  {isSelected && (
                    <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
                  )}
                </span>

                {/* Label + perk */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-foreground">Buy {tier.qty}</span>
                    {tier.perk && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-border bg-background text-[10px] font-semibold text-foreground/80">
                        {tier.qty >= 3 && <Gift className="w-3 h-3 text-primary" />}
                        {tier.perk}
                      </span>
                    )}
                  </div>
                  {savings > 0 ? (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      You save{" "}
                      <span className="font-semibold text-primary">
                        {formatPrice(savings, currency)}
                      </span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground mt-0.5">Standard price</p>
                  )}
                </div>

                {/* Price */}
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-sm text-foreground">
                    {formatPrice(bundleTotal, currency)}
                  </div>
                  {savings > 0 && (
                    <div className="text-[11px] text-muted-foreground line-through leading-tight">
                      {formatPrice(baselineTotal, currency)}
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function getBundleUnitPrice(
  unitPrice: number,
  qty: number,
  tiers: BundleTier[] = DEFAULT_TIERS,
) {
  const tier = tiers.find((t) => t.qty === qty) ?? tiers[0];
  return unitPrice * (1 - tier.extraDiscount);
}
