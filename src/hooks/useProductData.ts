import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveStorageImageUrl, STORAGE_PRODUCT_FALLBACK_URL } from "@/lib/storageImage";

const CATEGORY_FALLBACK = "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&q=80";

// Public-safe column list — excludes internal/sensitive cols (cogs, supplier_url, source_url)
// which are REVOKEd from the anon role at the database level.
const PRODUCT_PUBLIC_COLUMNS =
  "id, title, slug, description, price, compare_at_price, stock_quantity, is_active, created_at, updated_at, category_id, gallery_urls, sku, currency, rating, review_count, stock_status, tags, categories(name)";

export interface Product {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  image: string;
  category: string;
  category_id: string | null;
  stock_quantity: number;
  compare_at_price: number | null;
  currency: string;
  images: string[];
  sku: string | null;
  rating: number;
  review_count: number;
}

export interface DbCategory {
  id: string;
  name: string;
  slug: string;
  image_url?: string | null;
}

function mapDbProduct(p: any): Product {
  const galleryUrls: string[] = p.gallery_urls || [];
  const mainImage = galleryUrls[0] || null;
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    description: p.description || "",
    price: Number(p.price),
    image: resolveStorageImageUrl(mainImage, STORAGE_PRODUCT_FALLBACK_URL),
    category: p.categories?.name || "Uncategorized",
    category_id: p.category_id,
    stock_quantity: p.stock_quantity,
    compare_at_price: p.compare_at_price ? Number(p.compare_at_price) : null,
    currency: p.currency || "BDT",
    images: galleryUrls.map((img: string) =>
      resolveStorageImageUrl(img, STORAGE_PRODUCT_FALLBACK_URL),
    ),
    sku: p.sku,
    rating: Number(p.rating) || 0,
    review_count: Number(p.review_count) || 0,
  };
}

export type SortOption = "newest" | "price_asc" | "price_desc" | "rating";

export const useProducts = (params?: {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  sort?: SortOption;
}) => {
  return useQuery({
    queryKey: ["products", params],
    queryFn: async (): Promise<{ products: Product[]; total: number }> => {
      const limit = params?.limit || 12;
      const page = params?.page || 1;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from("products")
        .select(PRODUCT_PUBLIC_COLUMNS, { count: "exact" })
        .eq("is_active", true);

      if (params?.category) query = query.eq("category_id", params.category);
      if (params?.search) query = query.ilike("title", `%${params.search}%`);

      switch (params?.sort) {
        case "price_asc":
          query = query.order("price", { ascending: true });
          break;
        case "price_desc":
          query = query.order("price", { ascending: false });
          break;
        case "rating":
          query = query.order("rating", { ascending: false });
          break;
        default:
          query = query.order("created_at", { ascending: false });
      }

      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) {
        console.error("[Products] Query error:", error.message);
        return { products: [], total: 0 };
      }
      return {
        products: (data || []).map(mapDbProduct),
        total: count || 0,
      };
    },
  });
};

// Simple list query without pagination (for homepage sections)
export const useProductList = (params?: { limit?: number; sort?: SortOption }) => {
  return useQuery({
    queryKey: ["product-list", params],
    queryFn: async (): Promise<Product[]> => {
      let query = supabase
        .from("products")
        .select(PRODUCT_PUBLIC_COLUMNS)
        .eq("is_active", true)
        .limit(params?.limit || 8);

      switch (params?.sort) {
        case "price_asc":
          query = query.order("price", { ascending: true });
          break;
        case "price_desc":
          query = query.order("price", { ascending: false });
          break;
        case "rating":
          query = query
            .order("rating", { ascending: false })
            .order("review_count", { ascending: false });
          break;
        default:
          query = query.order("created_at", { ascending: false });
      }

      const { data, error } = await query;
      if (error) {
        console.error("[ProductList] Query error:", error.message);
        return [];
      }
      return (data || []).map(mapDbProduct);
    },
  });
};

export const useProduct = (idOrSlug: string) => {
  return useQuery({
    queryKey: ["product", idOrSlug],
    queryFn: async (): Promise<Product | null> => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrSlug,
      );
      let query = supabase.from("products").select(PRODUCT_PUBLIC_COLUMNS).eq("is_active", true);
      query = isUuid ? query.eq("id", idOrSlug) : query.eq("slug", idOrSlug);
      const { data, error } = await query.maybeSingle();
      if (error) {
        console.error("[Product] Query error:", error.message);
        return null;
      }
      if (!data) return null;
      return mapDbProduct(data);
    },
    enabled: !!idOrSlug,
  });
};

export const useCategories = () => {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<DbCategory[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, image_url")
        .order("name");
      if (error) {
        console.error("[Categories] Query error:", error.message);
        return [];
      }
      return (data || []).map((category) => ({
        ...category,
        image_url: resolveStorageImageUrl(category.image_url, CATEGORY_FALLBACK),
      }));
    },
  });
};
