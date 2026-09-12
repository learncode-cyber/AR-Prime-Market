import { Link } from "@tanstack/react-router";
import { useHomeCategoryCards } from "@/hooks/useHomeCategoryCards";

export const AmazonStyleCategories = () => {
  const { data: cards, isLoading } = useHomeCategoryCards();

  if (isLoading) {
    return (
      <section className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-card rounded-lg p-4 sm:p-2.5 sm:border sm:border-border sm:rounded-md animate-pulse"
            >
              <div className="h-6 sm:h-3 bg-muted rounded mb-3 sm:mb-1.5 w-3/4" />
              <div className="grid grid-cols-2 gap-3 sm:gap-1.5">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="aspect-square rounded-md sm:rounded-sm bg-muted" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!cards || cards.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        {cards.map((card) => (
          <Link
            key={card.id}
            to="/categories/$slug"
            params={{ slug: card.target_slug }}
            className="bg-card rounded-lg p-4 sm:p-2.5 sm:border sm:border-border sm:rounded-md flex flex-col sm:hover:shadow-md transition-shadow group"
          >
            <h3 className="font-display text-2xl sm:text-xs font-extrabold sm:font-bold tracking-tight text-foreground mb-3 sm:mb-1.5 sm:line-clamp-1">
              {card.title}
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:gap-1.5 flex-1">
              {card.items.slice(0, 4).map((item) => (
                <div key={item.id} className="block">
                  <div className="aspect-square rounded-md sm:rounded-sm overflow-hidden bg-secondary/40 relative">
                    <img
                      src={item.image_url || "/placeholder.svg"}
                      alt={item.label}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        const t = e.currentTarget;
                        if (!t.src.endsWith("/placeholder.svg")) t.src = "/placeholder.svg";
                      }}
                    />
                  </div>
                  <span className="text-sm sm:text-[10px] text-foreground/80 line-clamp-1 mt-2 sm:mt-0.5 block">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default AmazonStyleCategories;
