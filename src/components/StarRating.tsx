import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (rating: number) => void;
  showCount?: boolean;
  count?: number;
}

const sizeMap = { sm: "w-3 h-3", md: "w-4 h-4", lg: "w-5 h-5" };

export const StarRating = ({
  rating,
  maxStars = 5,
  size = "sm",
  interactive = false,
  onChange,
  showCount = false,
  count = 0,
}: StarRatingProps) => {
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: maxStars }).map((_, i) => {
          const filled = i < Math.round(rating);
          return (
            <button
              key={i}
              type="button"
              disabled={!interactive}
              onClick={() => interactive && onChange?.(i + 1)}
              className={cn(
                "transition-colors",
                interactive ? "cursor-pointer hover:scale-110" : "cursor-default",
              )}
            >
              <Star
                className={cn(
                  sizeMap[size],
                  filled ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30",
                )}
              />
            </button>
          );
        })}
      </div>
      {showCount && <span className="text-[10px] text-muted-foreground ml-0.5">({count})</span>}
    </div>
  );
};
