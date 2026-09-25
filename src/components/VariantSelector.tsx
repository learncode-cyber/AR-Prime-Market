import { memo, useMemo } from "react";
import type { ProductVariant } from "@/hooks/useProductVariants";
import { useCurrency } from "@/context/CurrencyContext";

interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedVariant: ProductVariant | null;
  onSelect: (variant: ProductVariant) => void;
  currency?: string;
}

/**
 * Groups variants by `name` (e.g. "Size", "Color") and renders a pill row per
 * group. Out-of-stock options are disabled with line-through.
 */
export const VariantSelector = memo(
  ({ variants, selectedVariant, onSelect, currency }: VariantSelectorProps) => {
    const { formatPrice } = useCurrency();

    const groups = useMemo(() => {
      const map = new Map<string, ProductVariant[]>();
      for (const v of variants) {
        if (!map.has(v.name)) map.set(v.name, []);
        map.get(v.name)!.push(v);
      }
      return Array.from(map.entries());
    }, [variants]);

    if (variants.length === 0) return null;

    return (
      <div className="space-y-4">
        {groups.map(([groupName, groupVariants]) => (
          <div key={groupName}>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              {groupName}
            </label>
            <div className="flex flex-wrap gap-2">
              {groupVariants.map((variant) => {
                const isSelected = selectedVariant?.id === variant.id;
                const inStock = variant.stock_quantity > 0;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => inStock && onSelect(variant)}
                    disabled={!inStock}
                    className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all touch-manipulation border ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : inStock
                          ? "bg-card border-border text-foreground hover:border-primary/50"
                          : "bg-muted/50 border-border text-muted-foreground/40 cursor-not-allowed line-through"
                    }`}
                  >
                    {variant.value}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {selectedVariant && (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {selectedVariant.sku && (
              <span className="text-muted-foreground">SKU: {selectedVariant.sku}</span>
            )}
            <span
              className={selectedVariant.stock_quantity > 0 ? "text-green-600" : "text-destructive"}
            >
              {selectedVariant.stock_quantity > 0
                ? `${selectedVariant.stock_quantity} in stock`
                : "Out of stock"}
            </span>
            {selectedVariant.additional_price !== 0 && (
              <span className="text-muted-foreground">
                {selectedVariant.additional_price > 0 ? "+" : ""}
                {formatPrice(selectedVariant.additional_price, currency)}
              </span>
            )}
          </div>
        )}
      </div>
    );
  },
);

VariantSelector.displayName = "VariantSelector";
