import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useProducts, useCategories } from "@/hooks/useProductData";
import { ProductCard } from "@/components/ProductCard";
import { supabase } from "@/integrations/supabase/client";

const SITE_URL = "https://arprimemarket.shop";
const SITE_NAME = "AR Prime Market";

type CategorySeo = { title: string; description: string; h1: string };

const CATEGORY_SEO: Record<string, CategorySeo> = {
  electronics: {
    title: "Premium Electronics & Innovative Smart Tech Store — AR Prime Market",
    description:
      "Shop premium electronics & innovative smart tech with free worldwide shipping to USA, Canada, UK, Europe & UAE. Secure global payments, fast tracked delivery.",
    h1: "Premium Electronics & Innovative Smart Tech",
  },
  beauty: {
    title: "Advanced Beauty Tech & Organic Skincare Aesthetics — USA & Worldwide",
    description:
      "Discover advanced beauty tech, LED therapy devices, and organic skincare aesthetics. Free worldwide shipping to USA, UK, Europe & UAE. Trusted by global buyers.",
    h1: "Advanced Beauty Tech & Organic Skincare Aesthetics",
  },
  fashion: {
    title: "Luxury Trendsetting Apparel & Aesthetic Fashion — Free Global Shipping",
    description:
      "Luxury trendsetting apparel & aesthetic fashion for men and women. Premium quality, free worldwide shipping to USA, Canada, UK, Europe & UAE.",
    h1: "Luxury Trendsetting Apparel & Aesthetic Fashion",
  },
  home: {
    title: "Modern Smart Home Appliances & Wellness Living Tech — AR Prime Market",
    description:
      "Smart home appliances & wellness living tech for modern apartments. Free worldwide shipping to USA, UK, Europe & UAE. Best global prices, fast delivery.",
    h1: "Modern Smart Home Appliances & Wellness Living Tech",
  },
  gadgets: {
    title: "Trending Micro-Gadgets & Eco-Tech Innovators — Best Global Prices",
    description:
      "Trending micro-gadgets & eco-tech innovators at the best global prices. Free worldwide shipping to USA, Canada, UK, Europe & UAE. Curated by AR Prime Market.",
    h1: "Trending Micro-Gadgets & Eco-Tech Innovators",
  },
  accessories: {
    title: "Travel Essentials & Premium Accessories — Free Worldwide Shipping",
    description:
      "Shop premium travel essentials, luggage, backpacks, organizers and adapters. Free worldwide shipping to USA, Canada, UK, Europe & UAE with secure global payments.",
    h1: "Travel Essentials & Premium Accessories",
  },
  sports: {
    title: "Fitness Gear, Sportswear & Performance Trackers — AR Prime Market",
    description:
      "Gear up to get fit with premium sportswear, fitness trackers, gym equipment and athletic shoes. Free worldwide shipping to USA, Canada, UK, Europe & UAE.",
    h1: "Fitness Gear, Sportswear & Performance Trackers",
  },
  books: {
    title: "Bestselling Books & Curated Reads — Global Delivery | AR Prime Market",
    description:
      "Discover bestselling books and curated reads with fast tracked delivery to USA, Canada, UK, Europe & UAE. Secure global payments and free worldwide shipping.",
    h1: "Bestselling Books & Curated Reads",
  },
};

export const Route = createFileRoute("/categories/$slug")({
  loader: async ({ params }) => {
    const seo = CATEGORY_SEO[params.slug.toLowerCase()];
    if (!seo) throw notFound();
    const { data } = await supabase
      .from("categories")
      .select("id, name, slug")
      .ilike("slug", params.slug)
      .maybeSingle();
    return {
      seo,
      category: data
        ? { id: data.id as string, name: data.name as string, slug: data.slug as string }
        : null,
    };
  },
  head: ({ params, loaderData }) => {
    const seo = loaderData?.seo;
    const url = `${SITE_URL}/categories/${params.slug}`;
    if (!seo) return { meta: [{ title: `${SITE_NAME}` }] };
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
            "@type": "CollectionPage",
            name: seo.title,
            description: seo.description,
            url,
          }),
        },
      ],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const { seo, category } = Route.useLoaderData();
  const { data: cats = [] } = useCategories();
  const resolved =
    category ?? cats.find((c) => c.slug?.toLowerCase() === slug.toLowerCase()) ?? null;
  const { data, isLoading } = useProducts({ page: 1, limit: 24, category: resolved?.id });
  const products = data?.products ?? [];

  return (
    <div className="min-h-screen bg-background">
      <section className="border-b border-border bg-card/50 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Link
            to="/products"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            <ChevronLeft className="w-4 h-4" /> All Products
          </Link>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-foreground">{seo.h1}</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-3xl">{seo.description}</p>
        </div>
      </section>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">
            No products in this category yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
