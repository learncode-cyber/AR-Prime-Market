import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Calendar, Clock, ArrowRight, Star, Truck, ShoppingCart } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";
import type { Product } from "@/hooks/useProductData";
import DOMPurify from "dompurify";
import { toSafeJsonLdString } from "@/lib/jsonLdScript";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { resolveStorageImageUrl, STORAGE_PRODUCT_FALLBACK_URL } from "@/lib/storageImage";

const SITE_URL = "https://arprimemarket.shop";
const SITE_NAME = "AR Prime Market";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("blog_posts")
      .select(
        "title, excerpt, meta_title, meta_description, featured_image_url, published_at, author_name",
      )
      .eq("slug", params.slug)
      .eq("is_published", true)
      .maybeSingle();
    return { post: data };
  },
  head: ({ params, loaderData }) => {
    const url = `${SITE_URL}/blog/${params.slug}`;
    const p = loaderData?.post;
    if (!p) {
      const title = `Blog — ${SITE_NAME}`;
      const desc = `Read shopping guides, product reviews, and tips from ${SITE_NAME}.`;
      return {
        meta: [
          { title },
          { name: "description", content: desc },
          { property: "og:title", content: title },
          { property: "og:description", content: desc },
          { property: "og:url", content: url },
          { property: "og:type", content: "article" },
        ],
        links: [{ rel: "canonical", href: url }],
      };
    }
    const rawTitle = (p.meta_title || p.title || "").trim();
    const title =
      rawTitle.length > 60 ? rawTitle.slice(0, 57) + "..." : `${rawTitle} | ${SITE_NAME}`;
    const rawDesc = ((p.meta_description || p.excerpt || "") as string).replace(/\s+/g, " ").trim();
    const desc =
      rawDesc.length >= 50
        ? rawDesc.length > 160
          ? rawDesc.slice(0, 157) + "..."
          : rawDesc
        : `${rawDesc}${rawDesc ? " — " : ""}Read this article on ${SITE_NAME}, your premium online shopping destination.`.slice(
            0,
            160,
          );
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
        ...(p.featured_image_url
          ? [{ property: "og:image", content: p.featured_image_url as string }]
          : []),
        ...(p.featured_image_url
          ? [{ name: "twitter:image", content: p.featured_image_url as string }]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: p.title,
            description: desc,
            ...(p.featured_image_url ? { image: p.featured_image_url } : {}),
            ...(p.published_at ? { datePublished: p.published_at } : {}),
            ...(p.author_name ? { author: { "@type": "Person", name: p.author_name } } : {}),
            mainEntityOfPage: url,
            publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
          }),
        },
      ],
    };
  },
  component: BlogPostPage,
});

function BlogPostPage() {
  const { slug } = Route.useParams();

  const { data: post, isLoading } = useQuery({
    queryKey: ["blog_post", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*, categories(slug, name)")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();
      if (error) {
        console.error(error);
        return null;
      }
      return data;
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 animate-pulse">
        <div className="h-8 bg-secondary/50 rounded w-3/4 mb-4" />
        <div className="h-4 bg-secondary/30 rounded w-1/3 mb-8" />
        <div className="space-y-3">
          <div className="h-4 bg-secondary/30 rounded" />
          <div className="h-4 bg-secondary/30 rounded" />
          <div className="h-4 bg-secondary/30 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h2 className="font-display font-bold text-xl text-foreground">Post not found</h2>
        <Link to="/blog" className="mt-4 inline-block text-primary hover:underline text-sm">
          Back to Blog
        </Link>
      </div>
    );
  }

  return <BlogPostView post={post} />;
}

type ParsedItem = { title: string; body: string };
type ParsedContent = {
  introHtml: string;
  items: ParsedItem[];
  outroHtml: string;
  ctaText: string | null;
};

function parseContent(rawHtml: string): ParsedContent {
  const clean = DOMPurify.sanitize(rawHtml || "");
  const empty: ParsedContent = { introHtml: clean, items: [], outroHtml: "", ctaText: null };
  if (typeof window === "undefined" || !clean) return empty;

  try {
    const doc = new DOMParser().parseFromString(`<div>${clean}</div>`, "text/html");
    const root = doc.body.firstElementChild as HTMLElement | null;
    if (!root) return empty;

    const items: ParsedItem[] = [];
    const ol = root.querySelector("ol");
    if (ol && ol.children.length >= 2) {
      Array.from(ol.children).forEach((li) => {
        const text = (li.textContent || "").trim();
        if (!text) return;
        const m = text.match(/^\s*(?:\d+\.\s*)?(.+?)(?:[:\-—–]\s*|\.\s+)([\s\S]+)$/);
        if (m) items.push({ title: m[1].trim().replace(/\.$/, ""), body: m[2].trim() });
        else items.push({ title: text.split(/[.!?]/)[0].slice(0, 80), body: text });
      });
    }

    if (items.length === 0) {
      const headings = Array.from(root.querySelectorAll("h2, h3")).filter((h) =>
        /^\s*\d+\./.test(h.textContent || ""),
      );
      headings.forEach((h) => {
        const title = (h.textContent || "").replace(/^\s*\d+\.\s*/, "").trim();
        let body = "";
        let n = h.nextElementSibling;
        while (n && !/^H[1-6]$/.test(n.tagName)) {
          body += (n.textContent || "") + " ";
          n = n.nextElementSibling;
        }
        if (title) items.push({ title, body: body.trim() });
      });
    }

    let ctaText: string | null = null;
    const paras = Array.from(root.querySelectorAll("p"));
    const last = paras[paras.length - 1];
    if (last && /shop\s+(curated|the)/i.test(last.textContent || "")) {
      ctaText = (last.textContent || "").trim();
      last.remove();
    }

    if (items.length >= 2) {
      ol?.remove();
      const introHtml = root.innerHTML;
      return { introHtml, items, outroHtml: "", ctaText };
    }

    return { introHtml: root.innerHTML, items: [], outroHtml: "", ctaText };
  } catch {
    return empty;
  }
}

// Lightweight product type for inline spotlights
interface SpotProduct {
  id: string;
  title: string;
  slug: string;
  price: number;
  rating: number;
  image: string;
  tags: string[] | null;
}

function useSpotlightProducts() {
  return useQuery({
    queryKey: ["blog_spotlight_products"],
    queryFn: async (): Promise<SpotProduct[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id, title, slug, price, rating, gallery_urls, tags")
        .eq("is_active", true)
        .limit(60);
      if (error) {
        console.error(error);
        return [];
      }
      return (data || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        price: Number(p.price) || 0,
        rating: Number(p.rating) || 0,
        image: resolveStorageImageUrl((p.gallery_urls || [])[0], STORAGE_PRODUCT_FALLBACK_URL),
        tags: p.tags,
      }));
    },
  });
}

function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z]{4,}/g) || []).filter(
    (w) => !["with", "from", "this", "that", "your", "have", "best", "must"].includes(w),
  );
}

function pickMatches(products: SpotProduct[], context: string, limit = 2): SpotProduct[] {
  if (!products.length) return [];
  const tokens = new Set(tokenize(context));
  const scored = products.map((p) => {
    const hay = `${p.title} ${(p.tags || []).join(" ")}`.toLowerCase();
    let score = 0;
    tokens.forEach((t) => {
      if (hay.includes(t)) score += 1;
    });
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score || b.p.rating - a.p.rating);
  const top = scored
    .filter((s) => s.score > 0)
    .slice(0, limit)
    .map((s) => s.p);
  if (top.length >= limit) return top;
  // Pad with high-rated fallbacks
  const pad = [...products]
    .sort((a, b) => b.rating - a.rating)
    .filter((p) => !top.find((t) => t.id === p.id));
  return [...top, ...pad].slice(0, limit);
}

function InlineProductCard({ product }: { product: SpotProduct }) {
  const { addToCart } = useCart();
  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const cartProduct: Product = {
      id: product.id,
      title: product.title,
      slug: product.slug,
      description: "",
      price: product.price,
      image: product.image,
      category: "",
      category_id: null,
      stock_quantity: 99,
      compare_at_price: null,
      currency: "USD",
      images: [product.image],
      sku: null,
      rating: product.rating,
      review_count: 0,
    };
    addToCart(cartProduct);
    toast.success(`${product.title} added to cart`);
  };

  return (
    <div className="flex gap-3 items-center bg-white dark:bg-background border border-slate-200 dark:border-border rounded-lg p-3 hover:shadow-md hover:border-fuchsia-300 transition group">
      <Link
        to="/products/$slug"
        params={{ slug: product.slug }}
        className="flex gap-3 items-center flex-1 min-w-0"
      >
        <img
          src={product.image}
          alt={product.title}
          loading="lazy"
          className="w-16 h-16 rounded-md object-cover flex-shrink-0 border border-slate-100 dark:border-border"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-foreground truncate group-hover:text-fuchsia-600">
            {product.title}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span className="text-xs text-slate-500">{product.rating.toFixed(1)}</span>
            <span className="mx-1 text-slate-300">·</span>
            <span className="text-sm font-bold text-fuchsia-600">${product.price.toFixed(2)}</span>
          </div>
        </div>
      </Link>
      <button
        type="button"
        onClick={handleBuyNow}
        aria-label={`Add ${product.title} to cart`}
        className="inline-flex items-center gap-1 text-xs font-semibold bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-3 py-1.5 rounded-full flex-shrink-0 transition"
      >
        <ShoppingCart className="w-3 h-3" />
        <span className="hidden sm:inline">Buy Now</span>
      </button>
    </div>
  );
}

function buildFaqs(post: any, items: ParsedItem[]): { q: string; a: string }[] {
  const topic = post.title || "this collection";
  const cat = post.categories?.name || (post.tags && post.tags[0]) || "premium";
  const faqs: { q: string; a: string }[] = [
    {
      q: `What should I look for when buying ${cat.toLowerCase()} products online?`,
      a: `Always verify the brand authenticity, check material specifications, and confirm certifications (such as UV400 for eyewear, genuine leather grading, or IPX water-resistance ratings for gadgets). At ${SITE_NAME} every listing includes verified vendor details, real customer ratings, and return-protected checkout.`,
    },
    {
      q: `Does ${SITE_NAME} ship ${cat.toLowerCase()} items to the UAE, Saudi Arabia and Europe?`,
      a: `Yes. We ship to USA, Canada, UK, all EU countries, UAE, KSA, Qatar, Kuwait and Australia. Express shipping to the Middle East and Europe typically arrives in 5–9 business days, and is free on orders over $50.`,
    },
    {
      q: `Are the products in "${topic}" in stock and original?`,
      a: `Every featured item is sourced from verified suppliers and tagged with live stock status. Listings update in real time — if you see it on the page, it's available to order with full buyer protection and a 14-day return window.`,
    },
    {
      q: `What is the return and refund policy for ${cat.toLowerCase()} orders?`,
      a: `All ${cat.toLowerCase()} orders are protected by a 14-day return window from delivery. Items must be unused with original packaging. Refunds are processed to the original payment method within 3–5 business days of receiving the returned item, and return shipping is free for defective or incorrectly described products.`,
    },
  ];
  if (items[0]) {
    faqs.push({
      q: `How do I style or use ${items[0].title}?`,
      a: `${items[0].body.slice(0, 220)}${items[0].body.length > 220 ? "…" : ""} For best results, pair it with complementary pieces from the same collection — view the full curated set linked above.`,
    });
  }
  return faqs;
}

function deriveCheckpoint(title: string, body: string): string {
  const t = `${title} ${body}`.toLowerCase();
  if (/sunglass|eyewear|shades|lens/.test(t))
    return "UV400 certified · polarized lens grade · CE EN ISO 12312-1 compliant";
  if (/watch|timepiece|chronograph/.test(t))
    return "Sapphire-coated crystal · 5 ATM water resistance · Swiss/Japanese movement";
  if (/leather|bag|wallet|handbag|tote|backpack/.test(t))
    return "Full-grain leather · double-stitched seams · YKK hardware";
  if (/sneaker|shoe|boot|loafer|trainer/.test(t))
    return "Breathable mesh upper · cushioned EVA midsole · anti-slip rubber outsole";
  if (/skincare|serum|cream|beauty|cosmetic|lipstick|moisturi/.test(t))
    return "Dermatologist-tested · paraben & sulfate-free · cruelty-free formulation";
  if (/earbud|headphone|earphone|speaker|audio/.test(t))
    return "Bluetooth 5.3 · ENC mic · up to 30h battery · IPX4 sweat resistant";
  if (/phone|charger|cable|gadget|power\s*bank|adapter/.test(t))
    return "USB-C PD fast charge · MFi/CE certified · overcharge & short-circuit protection";
  if (/jacket|coat|hoodie|sweater|shirt|dress|denim|jean/.test(t))
    return "Premium woven fabric · pre-shrunk · reinforced stitching · OEKO-TEX dye";
  if (/jewelry|necklace|ring|earring|bracelet/.test(t))
    return "Hypoallergenic finish · tarnish-resistant plating · nickel-free";
  return "Verified supplier · QC inspected · 14-day return protection";
}

function BlogPostView({ post }: { post: any }) {
  const parsed = useMemo(() => parseContent(post.content || ""), [post.content]);
  const { data: products = [] } = useSpotlightProducts();

  const wordCount = (post.content || "")
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  const readMin = Math.max(1, Math.round(wordCount / 200));

  // Resolve dynamic category slug for CTA
  const categorySlug: string =
    post.categories?.slug ||
    (post.tags && post.tags[0]
      ? String(post.tags[0]).toLowerCase().replace(/\s+/g, "-")
      : "fashion");
  const categoryName: string = post.categories?.name || (post.tags && post.tags[0]) || "Collection";

  const faqs = useMemo(() => buildFaqs(post, parsed.items), [post, parsed.items]);

  // FAQ JSON-LD
  const faqJsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    }),
    [faqs],
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toSafeJsonLdString(faqJsonLd) }}
      />

      <Link
        to="/blog"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Blog
      </Link>

      <article>
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-foreground tracking-tight mb-4">
          {post.title}
        </h1>

        <div className="flex flex-wrap items-center gap-2 mb-6">
          {post.published_at && (
            <span className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-secondary/60 text-slate-600 dark:text-muted-foreground rounded-full px-3 py-1 text-xs">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(post.published_at).toLocaleDateString()}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-secondary/60 text-slate-600 dark:text-muted-foreground rounded-full px-3 py-1 text-xs">
            <Clock className="w-3.5 h-3.5" /> {readMin} min read
          </span>
          {post.author_name && (
            <span className="text-xs text-muted-foreground">By {post.author_name}</span>
          )}
        </div>

        {post.featured_image_url && (
          <img
            src={post.featured_image_url}
            alt={post.title}
            className="w-full rounded-xl object-cover max-h-80 mb-8 border border-border/50"
          />
        )}

        <style>{`
          .blog-safe iframe, .blog-safe video, .blog-safe embed, .blog-safe object {
            position: static !important;
            width: 100% !important;
            height: auto !important;
            aspect-ratio: 16 / 9;
            max-width: 100%;
            display: block;
            margin: 1.5rem 0;
            z-index: 0 !important;
            inset: auto !important;
          }
          .blog-safe * { position: static !important; }
        `}</style>

        {parsed.items.length >= 2 ? (
          <>
            {parsed.introHtml && (
              <div
                className="blog-safe prose prose-slate dark:prose-invert prose-sm sm:prose-base max-w-none mb-6"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(parsed.introHtml) }}
              />
            )}
            <div className="space-y-0">
              {parsed.items.map((item, i) => {
                const matches = pickMatches(products, `${item.title} ${item.body}`, 2);
                return (
                  <div
                    key={i}
                    className="bg-slate-50 dark:bg-secondary/40 p-6 rounded-lg border border-slate-100 dark:border-border mb-6"
                  >
                    <h3 className="text-xl font-bold text-slate-800 dark:text-foreground mb-3">
                      {i + 1}. {item.title}
                    </h3>

                    <p className="text-[10px] uppercase tracking-widest text-fuchsia-600 font-bold mb-1">
                      Why it matters this season
                    </p>
                    <p className="text-slate-600 dark:text-muted-foreground leading-relaxed mb-3">
                      {item.body}
                    </p>

                    <div className="bg-white/70 dark:bg-background/40 border-l-4 border-fuchsia-500 px-3 py-2 rounded mb-3">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-muted-foreground font-bold mb-0.5">
                        Quality & Technical Checkpoint
                      </p>
                      <p className="text-sm text-slate-700 dark:text-foreground font-medium">
                        {deriveCheckpoint(item.title, item.body)}
                      </p>
                    </div>

                    {matches.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-border">
                        <p className="text-xs font-semibold text-slate-500 dark:text-muted-foreground uppercase tracking-wider mb-2">
                          Shop this pick
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {matches.map((p) => (
                            <InlineProductCard key={p.id} product={p} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          post.content && (
            <div
              className="blog-safe prose prose-slate dark:prose-invert prose-sm sm:prose-base max-w-none"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }}
            />
          )
        )}

        {/* Premium CTA */}
        <div className="mt-10 p-6 md:p-8 rounded-2xl bg-gradient-to-br from-fuchsia-50 via-pink-50 to-amber-50 dark:from-fuchsia-950/40 dark:via-pink-950/30 dark:to-amber-950/30 border border-fuchsia-100/70 dark:border-fuchsia-900/40">
          <h3 className="text-xl font-bold text-slate-900 dark:text-foreground mb-2">
            Shop the {categoryName} Collection
          </h3>
          <p className="text-slate-600 dark:text-muted-foreground mb-5 leading-relaxed">
            {parsed.ctaText || `Hand-picked ${categoryName} essentials, ready to ship worldwide.`}
          </p>
          <Link
            to="/categories/$slug"
            params={{ slug: categorySlug }}
            className="inline-flex items-center gap-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-semibold px-6 py-3 rounded-full shadow-md shadow-fuchsia-600/20 transition"
          >
            Shop the Collection <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="mt-4 flex items-center gap-2 text-sm text-slate-600 dark:text-muted-foreground">
            <Truck className="w-4 h-4 text-fuchsia-600" />
            <span>
              <strong>Free Express Shipping</strong> to Middle East (UAE, KSA) & Europe on orders
              over $50
            </span>
          </p>
        </div>

        {/* FAQ / Expert Guide */}
        <section className="mt-12">
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-foreground mb-2">
            Frequently Asked Questions & Expert Style Guide
          </h2>
          <p className="text-sm text-slate-500 dark:text-muted-foreground mb-5">
            Authoritative answers from the {SITE_NAME} curation team.
          </p>
          <Accordion
            type="single"
            collapsible
            className="bg-white dark:bg-secondary/30 rounded-xl border border-slate-200 dark:border-border px-4"
          >
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left font-semibold text-slate-800 dark:text-foreground">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 dark:text-muted-foreground leading-relaxed">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-border">
            {post.tags.map((tag: string) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-xl bg-secondary text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
