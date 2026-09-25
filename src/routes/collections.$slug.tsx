import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard } from "@/components/ProductCard";
import { parseCollectionSlug, buildCollectionSeo } from "@/lib/collectionSeo";
import type { Product } from "@/hooks/useProductData";

const SITE_URL = "https://arprimemarket.shop";
const SITE_NAME = "AR Prime Market";

const PRODUCT_COLUMNS =
  "id,title,slug,description,price,compare_at_price,gallery_urls,rating,review_count,stock_quantity,category_id,currency";

export const Route = createFileRoute("/collections/$slug")({
  loader: async ({ params }) => {
    const criteria = parseCollectionSlug(params.slug);
    if (!criteria) throw notFound();

    let categoryId: string | null = null;
    if (criteria.category) {
      const { data: cat } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", criteria.category)
        .maybeSingle();
      categoryId = cat?.id ?? null;
    }

    let q = supabase.from("products").select(PRODUCT_COLUMNS).eq("is_active", true).limit(48);
    if (categoryId) q = q.eq("category_id", categoryId);
    if (criteria.priceMax) q = q.lte("price", criteria.priceMax);
    if (criteria.priceMin) q = q.gte("price", criteria.priceMin);

    switch (criteria.sort) {
      case "price_asc":
        q = q.order("price", { ascending: true });
        break;
      case "price_desc":
        q = q.order("price", { ascending: false });
        break;
      case "newest":
        q = q.order("created_at", { ascending: false });
        break;
      default:
        q = q.order("rating", { ascending: false }).order("review_count", { ascending: false });
    }

    const { data } = await q;
    const products = (data || []) as unknown as Product[];
    const seo = buildCollectionSeo(criteria);

    return { criteria, products, seo };
  },
  head: ({ params, loaderData }) => {
    const url = `${SITE_URL}/collections/${params.slug}`;
    const seo = loaderData?.seo;
    if (!seo) {
      return {
        meta: [{ title: `Collection — ${SITE_NAME}` }],
        links: [{ rel: "canonical", href: url }],
      };
    }
    const items = (loaderData?.products || []).slice(0, 20).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/products/${p.slug}`,
      name: p.title,
    }));
    return {
      meta: [
        { title: seo.title },
        { name: "description", content: seo.description },
        { property: "og:title", content: seo.title },
        { property: "og:description", content: seo.description },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: seo.h1,
            itemListElement: items,
          }),
        },
      ],
    };
  },
  component: CollectionPage,
  notFoundComponent: () => (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center">
      <h1 className="text-2xl font-bold mb-2">Collection not found</h1>
      <Link to="/products" className="text-primary underline">
        Browse all products
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center">
      <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
});

function CollectionPage() {
  const { seo, products } = Route.useLoaderData();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <Link
        to="/products"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="w-4 h-4 mr-1" /> All Products
      </Link>
      <header className="mb-6">
        <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight">{seo.h1}</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-2xl">
          {seo.description}
        </p>
      </header>

      {products.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          No products match this collection right now.{" "}
          <Link to="/products" className="text-primary underline">
            Browse all
          </Link>
          .
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {products.map((p: Product) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
