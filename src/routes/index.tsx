import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useProductList, useCategories } from "@/hooks/useProductData";
import { HeroBanner } from "@/components/HeroBanner";
import { ProductSection } from "@/components/ProductSection";
import FlashSaleTimer from "@/components/FlashSaleTimer";
import PromotionsBanner from "@/components/PromotionsBanner";
import { TrustBadges } from "@/components/TrustBadges";
import { CustomerReviews } from "@/components/CustomerReviews";
import RecentlyViewed from "@/components/RecentlyViewed";
import { AmazonStyleCategories } from "@/components/AmazonStyleCategories";

const SITE_URL = "https://arprimemarket.shop";
const SITE_NAME = "AR Prime Market";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AR Prime Market — Premium Online Shopping Worldwide" },
      {
        name: "description",
        content:
          "Shop premium electronics, beauty, fashion, home & gadgets with secure global payments and fast tracked shipping to USA, Canada, UK, Europe & UAE.",
      },
      { property: "og:title", content: "AR Prime Market — Premium Online Shopping Worldwide" },
      {
        property: "og:description",
        content:
          "Shop premium electronics, beauty, fashion, home & gadgets with secure global payments and fast tracked shipping worldwide.",
      },
      { property: "og:url", content: SITE_URL + "/" },
    ],
    links: [{ rel: "canonical", href: SITE_URL + "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": `${SITE_URL}/#arqudrix`,
              name: "AR Qudrix",
              alternateName: "AR Qudrix Digital",
              url: "https://arqudrix.com",
              logo: `${SITE_URL}/icon-512.png`,
              description:
                "AR Qudrix is the parent technology company behind AR Prime Market and other premium digital products and platforms.",
              subOrganization: { "@id": `${SITE_URL}/#arprimemarket` },
            },
            {
              "@type": "Organization",
              "@id": `${SITE_URL}/#arprimemarket`,
              name: SITE_NAME,
              legalName: "AR Prime Market",
              url: SITE_URL,
              logo: `${SITE_URL}/icon-512.png`,
              description:
                "AR Prime Market is the international e-commerce platform of AR Qudrix, offering premium electronics, beauty, fashion, home and gadgets with global shipping.",
              parentOrganization: { "@id": `${SITE_URL}/#arqudrix` },
              brand: { "@id": `${SITE_URL}/#arqudrix` },
              sameAs: [
                "https://www.facebook.com/arprimemarket",
                "https://www.instagram.com/arprimemarket",
                "https://x.com/arprimemarket",
              ],
            },
            {
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
              name: SITE_NAME,
              url: SITE_URL,
              publisher: { "@id": `${SITE_URL}/#arqudrix` },
              potentialAction: {
                "@type": "SearchAction",
                target: `${SITE_URL}/products?search={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            },
          ],
        }),
      },
    ],
  }),
  component: Index,
});

const categoryImages = [
  {
    name: "Electronics",
    image:
      "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=500&q=85&auto=format&fit=crop",
  },
  {
    name: "Beauty",
    image:
      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500&q=85&auto=format&fit=crop",
  },
  {
    name: "Fashion",
    image:
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=500&q=85&auto=format&fit=crop",
  },
  {
    name: "Home",
    image:
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500&q=85&auto=format&fit=crop",
  },
  {
    name: "Gadgets",
    image:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=85&auto=format&fit=crop",
  },
];

function Index() {
  const { t } = useLanguage();
  const { data: featured = [], isLoading: featuredLoading } = useProductList({
    limit: 10,
    sort: "newest",
  });
  const { data: newArrivals = [] } = useProductList({ limit: 12, sort: "newest" });
  const { data: trending = [] } = useProductList({ limit: 10, sort: "rating" });
  const { data: bestSelling = [] } = useProductList({ limit: 10, sort: "rating" });
  const { data: categories = [] } = useCategories();

  return (
    <div className="relative">
      {/* Hero Slider */}
      <HeroBanner />

      {/* Promotions / Coupon Banner */}
      <PromotionsBanner />

      {/* Trust Badges */}
      <TrustBadges />

      {/* Flash Sale Timer (above Featured) */}
      <FlashSaleTimer />
      {/* Featured Products */}
      <ProductSection
        title={t("featured")}
        products={featured}
        scrollable
        loading={featuredLoading}
      />

      {/* 3. Shop by Category — Amazon-style cards */}
      <AmazonStyleCategories />

      {/* 5. New Arrivals */}
      <ProductSection title={t("newArrivals")} products={newArrivals} />

      {/* 6. Customer Reviews */}
      <CustomerReviews />

      {/* 7. Trending Now */}
      <ProductSection title={t("trending")} products={trending} scrollable />

      {/* Mega Sale Banner — between Trending & Best Selling */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="bg-primary rounded-2xl p-6 sm:p-10 md:p-14 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 sm:w-72 sm:h-72 rounded-full bg-primary-foreground/5 blur-3xl pointer-events-none" />
          <h2 className="font-display text-xl sm:text-3xl font-bold text-primary-foreground mb-2 relative">
            {t("megaSale")}
          </h2>
          <p className="text-xs sm:text-sm text-primary-foreground/80 mb-5 max-w-md mx-auto relative">
            {t("megaSaleDesc")}
          </p>
          <Link to="/products">
            <span className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-foreground text-primary font-semibold text-sm transition-all hover:brightness-95 active:scale-[0.97] touch-manipulation">
              {t("shopTheSale")} <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>
      </section>

      {/* 8. Best Selling */}
      <ProductSection title={t("bestSelling")} products={bestSelling} loading={featuredLoading} />

      {/* Recently Viewed (localStorage-driven, hidden if empty) */}
      <RecentlyViewed />
    </div>
  );
}
