// Programmatic SEO engine — parses URL slugs into product query criteria
// and produces dynamic title/description/H1 for SEO landing pages.

export type CollectionCriteria = {
  category?: string; // e.g. "electronics"
  modifier?: string; // "best", "top-rated", "new", "trending", "premium", "luxury", "cheap"
  priceMax?: number; // "under-100"
  priceMin?: number; // "over-50"
  sort: "newest" | "rating" | "price_asc" | "price_desc";
};

const CATEGORY_SLUGS = [
  "electronics",
  "beauty",
  "fashion",
  "home",
  "gadgets",
  "accessories",
  "books",
  "sports",
];
const MODIFIERS = [
  "best",
  "top-rated",
  "top",
  "new",
  "newest",
  "trending",
  "premium",
  "luxury",
  "cheap",
  "affordable",
  "popular",
  "bestselling",
];

const CATEGORY_LABEL: Record<string, string> = {
  electronics: "Electronics",
  beauty: "Beauty Products",
  fashion: "Fashion",
  home: "Home Essentials",
  gadgets: "Gadgets",
  accessories: "Accessories",
  books: "Books",
  sports: "Sports Gear",
};

const MODIFIER_LABEL: Record<string, string> = {
  best: "Best",
  "top-rated": "Top-Rated",
  top: "Top",
  new: "New",
  newest: "Newest",
  trending: "Trending",
  premium: "Premium",
  luxury: "Luxury",
  cheap: "Affordable",
  affordable: "Affordable",
  popular: "Most Popular",
  bestselling: "Best-Selling",
};

export function parseCollectionSlug(slug: string): CollectionCriteria | null {
  const parts = slug.toLowerCase().split("-").filter(Boolean);
  if (parts.length === 0) return null;

  const criteria: CollectionCriteria = { sort: "rating" };

  // detect modifier (may be 1 or 2 words like "top-rated")
  if (parts[0] === "top" && parts[1] === "rated") {
    criteria.modifier = "top-rated";
    parts.splice(0, 2);
  } else if (MODIFIERS.includes(parts[0])) {
    criteria.modifier = parts[0];
    parts.shift();
  }

  // detect category
  for (let i = 0; i < parts.length; i++) {
    if (CATEGORY_SLUGS.includes(parts[i])) {
      criteria.category = parts[i];
      parts.splice(i, 1);
      break;
    }
  }

  // detect price: "under-100" or "over-50"
  for (let i = 0; i < parts.length - 1; i++) {
    const n = Number(parts[i + 1]);
    if (!Number.isFinite(n)) continue;
    if (parts[i] === "under" || parts[i] === "below") {
      criteria.priceMax = n;
      parts.splice(i, 2);
      break;
    }
    if (parts[i] === "over" || parts[i] === "above") {
      criteria.priceMin = n;
      parts.splice(i, 2);
      break;
    }
  }

  // valid only if we matched at least category OR modifier
  if (!criteria.category && !criteria.modifier) return null;

  // sort selection
  if (criteria.modifier === "new" || criteria.modifier === "newest") criteria.sort = "newest";
  else if (criteria.modifier === "cheap" || criteria.modifier === "affordable")
    criteria.sort = "price_asc";
  else if (criteria.modifier === "premium" || criteria.modifier === "luxury")
    criteria.sort = "price_desc";

  return criteria;
}

export function buildCollectionSeo(c: CollectionCriteria) {
  const mod = c.modifier ? (MODIFIER_LABEL[c.modifier] ?? "") : "";
  const cat = c.category ? (CATEGORY_LABEL[c.category] ?? "") : "Products";
  const priceFragment = c.priceMax
    ? ` Under $${c.priceMax}`
    : c.priceMin
      ? ` Over $${c.priceMin}`
      : "";

  const h1 = `${mod ? mod + " " : ""}${cat}${priceFragment}`.trim();
  const title = `${h1} — Free Worldwide Shipping | AR Prime Market`;
  const description = `Shop ${mod ? mod.toLowerCase() + " " : ""}${cat.toLowerCase()}${priceFragment.toLowerCase()} with secure global payments and fast tracked shipping to USA, Canada, UK, Europe & UAE.`;

  return { h1, title, description };
}

// Curated set used for sitemap and discovery links
export const PROGRAMMATIC_COLLECTIONS: string[] = [
  "best-electronics",
  "top-rated-electronics",
  "electronics-under-100",
  "premium-electronics",
  "best-beauty",
  "trending-beauty",
  "luxury-beauty",
  "best-fashion",
  "new-fashion",
  "fashion-under-100",
  "premium-fashion",
  "best-home",
  "top-rated-home",
  "home-under-50",
  "best-gadgets",
  "trending-gadgets",
  "gadgets-under-50",
  "premium-gadgets",
  "bestselling-electronics",
  "bestselling-gadgets",
];
