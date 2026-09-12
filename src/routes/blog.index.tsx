import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "lucide-react";
import { FeatureGate } from "@/components/FeatureGate";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog — AR Prime Market" },
      {
        name: "description",
        content: "Buying guides, product roundups and lifestyle tips from AR Prime Market.",
      },
      { property: "og:title", content: "Blog — AR Prime Market" },
      {
        property: "og:description",
        content: "Buying guides, product roundups and lifestyle tips from AR Prime Market.",
      },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "https://arprimemarket.shop/blog" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "AR Prime Market Blog",
          url: "https://arprimemarket.shop/blog",
        }),
      },
    ],
  }),
  component: () => (
    <FeatureGate flag="blog">
      <BlogPage />
    </FeatureGate>
  ),
});

function BlogPage() {
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["blog_posts_public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, title, slug, excerpt, published_at, tags, featured_image_url")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(30);
      if (error) {
        console.error(error);
        return [];
      }
      return data || [];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <section className="py-12 sm:py-16 bg-card/50 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-foreground">Blog</h1>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            Buying guides, product roundups and lifestyle tips — fresh from the AR Prime Market
            team.
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="rounded-md border border-border bg-card overflow-hidden animate-pulse"
              >
                <div className="aspect-[16/10] bg-secondary/40" />
                <div className="p-4">
                  <div className="h-5 bg-secondary/50 rounded w-3/4 mb-3" />
                  <div className="h-4 bg-secondary/30 rounded w-full mb-2" />
                  <div className="h-4 bg-secondary/30 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <h2 className="font-display font-semibold text-lg text-foreground">
              New posts are on the way
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Our editors are publishing fresh guides every week. Check back soon!
            </p>
            <Link
              to="/products"
              className="inline-flex mt-6 px-5 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
            >
              Browse products instead
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {posts.map((post) => (
              <Link
                key={post.id}
                to="/blog/$slug"
                params={{ slug: post.slug }}
                className="group block rounded-md border border-border bg-card overflow-hidden card-hover"
              >
                <div className="aspect-[16/10] overflow-hidden bg-secondary/30">
                  {post.featured_image_url ? (
                    <img
                      src={post.featured_image_url}
                      alt={post.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                      AR Prime Market
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h2 className="font-display font-semibold text-base text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {post.excerpt}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    {post.published_at && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {new Date(post.published_at).toLocaleDateString()}
                      </span>
                    )}
                    {post.tags && post.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {post.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-sm bg-secondary text-[10px] text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
