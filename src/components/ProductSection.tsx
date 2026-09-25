import { motion } from "framer-motion";
import { ChevronRight, ShoppingBag } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ProductCard } from "./ProductCard";
import type { Product } from "@/hooks/useProductData";
import { useLanguage } from "@/context/LanguageContext";

interface ProductSectionProps {
  title: string;
  products: Product[];
  scrollable?: boolean;
  loading?: boolean;
}

export const ProductSection = ({ title, products, scrollable, loading }: ProductSectionProps) => {
  const { t } = useLanguage();

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="flex items-end justify-between mb-4 sm:mb-6"
      >
        <div>
          <h2 className="font-display text-lg sm:text-2xl font-bold text-foreground">{title}</h2>
        </div>
        <Link
          to="/products"
          className="text-primary text-xs sm:text-sm font-medium hover:underline flex items-center gap-1"
        >
          {t("viewAll")} <ChevronRight className="w-4 h-4" />
        </Link>
      </motion.div>

      {loading ? (
        <div
          className={`grid ${scrollable ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" : "grid-cols-2 md:grid-cols-4"} gap-3 sm:gap-4`}
        >
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-md border border-border bg-card p-4 animate-pulse">
              <div className="aspect-square rounded-md bg-secondary/50 mb-3" />
              <div className="h-4 bg-secondary/50 rounded mb-2" />
              <div className="h-3 bg-secondary/30 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-8">
          <ShoppingBag className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No products yet</p>
        </div>
      ) : scrollable ? (
        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
          {products.map((product) => (
            <div key={product.id} className="w-[42vw] sm:w-[220px] shrink-0 snap-start">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
};
