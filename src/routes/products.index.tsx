import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search, ShoppingBag, ChevronLeft, ChevronRight } from "lucide-react";
import { useProducts, useCategories, type SortOption, type Product } from "@/hooks/useProductData";
import { useLanguage } from "@/context/LanguageContext";
import { ProductCard } from "@/components/ProductCard";
import { ProductQuickViewDialog } from "@/components/ProductQuickViewDialog";
import { GlassCtaButton } from "@/components/GlassCtaButton";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

const searchSchema = z.object({
  page: fallback(z.number().int().min(1), 1).default(1),
  sort: fallback(z.enum(["newest", "price_asc", "price_desc", "rating"]), "newest").default(
    "newest",
  ),
  category: z.string().optional(),
  q: z.string().optional(),
});

type SearchParams = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/products/")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Products — AR Prime Market" },
      { name: "description", content: "Browse our curated collection of premium products." },
      { property: "og:title", content: "Products — AR Prime Market" },
      { property: "og:description", content: "Browse our curated collection of premium products." },
    ],
  }),
  component: ProductsPage,
});

const ITEMS_PER_PAGE = 12;

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
  { value: "rating", label: "Best Rating" },
];

function ProductsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate({ from: "/products/" });
  const { page, sort, category, q } = Route.useSearch();
  const [searchInput, setSearchInput] = useState(q || "");
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const { data, isLoading } = useProducts({
    page,
    limit: ITEMS_PER_PAGE,
    category,
    search: q,
    sort,
  });
  const { data: categories = [] } = useCategories();

  const products = data?.products ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const updateSearch = (updates: Partial<SearchParams>) => {
    navigate({ search: { page, sort, category, q, ...updates } as any });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateSearch({ q: searchInput || undefined, page: 1 });
  };

  return (
    <div className="min-h-screen bg-background">
      <section className="border-b border-border bg-card/50 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-foreground">
            {t("products")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("browseCollection")}</p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Search, Sort & Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <form onSubmit={handleSearch} className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("searchProducts")}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </form>
          <select
            value={sort}
            onChange={(e) => updateSearch({ sort: e.target.value as SortOption, page: 1 })}
            className="px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <GlassCtaButton className="self-center sm:self-auto" />
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
          <button
            onClick={() => updateSearch({ category: undefined, page: 1 })}
            className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
              !category
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground hover:bg-secondary/80"
            }`}
          >
            {t("viewAll")}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => updateSearch({ category: cat.id, page: 1 })}
              className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                category === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground hover:bg-secondary/80"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-md border border-border bg-card p-4 animate-pulse">
                <div className="aspect-square rounded-md bg-secondary/50 mb-3" />
                <div className="h-4 bg-secondary/50 rounded mb-2" />
                <div className="h-3 bg-secondary/30 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">{t("noProductsFound")}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} onQuickView={setQuickViewProduct} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => updateSearch({ page: Math.max(1, page - 1) })}
                  disabled={page <= 1}
                  className="p-2 rounded-lg border border-border hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-muted-foreground px-3">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => updateSearch({ page: Math.min(totalPages, page + 1) })}
                  disabled={page >= totalPages}
                  className="p-2 rounded-lg border border-border hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <ProductQuickViewDialog
        product={quickViewProduct}
        open={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
      />
    </div>
  );
}
