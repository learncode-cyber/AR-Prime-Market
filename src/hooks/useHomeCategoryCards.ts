import { useQuery } from "@tanstack/react-query";
import { listHomeCategoryCardsPublic } from "@/lib/home-categories.functions";

export function useHomeCategoryCards() {
  return useQuery({
    queryKey: ["home-category-cards", "public"],
    queryFn: () => listHomeCategoryCardsPublic(),
    staleTime: 60_000,
  });
}
