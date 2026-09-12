import { Heart } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useWishlistStatus, useToggleWishlist } from "@/hooks/useWishlist";
import { toast } from "sonner";

interface WishlistButtonProps {
  productId: string;
  className?: string;
  size?: "sm" | "md";
}

export const WishlistButton = ({ productId, className = "", size = "sm" }: WishlistButtonProps) => {
  const { user } = useAuth();
  const active = useWishlistStatus(productId);
  const toggleMutation = useToggleWishlist();
  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  const padding = size === "sm" ? "p-1.5" : "p-2";

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error("Please login to use wishlist");
      return;
    }
    toggleMutation.mutate(productId);
  };

  return (
    <button
      onClick={handleClick}
      className={`${padding} rounded-lg transition-all touch-manipulation active:scale-90 ${
        active ? "text-red-500" : "text-muted-foreground hover:text-red-400"
      } ${className}`}
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
    >
      <Heart className={`${iconSize} ${active ? "fill-current" : ""}`} />
    </button>
  );
};
