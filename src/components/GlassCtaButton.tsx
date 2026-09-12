import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface GlassCtaButtonProps {
  to?: string;
  href?: string;
  label?: string;
  className?: string;
}

/**
 * Premium light-glassmorphism CTA — fuchsia (#E11D74) → gold (#E8B84A)
 * gradient border, frosted white glass body, deep magenta (#7A1145) text.
 * Designed for AR Prime Market's white background.
 */
export function GlassCtaButton({
  to = "/products",
  href,
  label = "New Arrivals for You",
  className,
}: GlassCtaButtonProps) {
  const inner = (
    <span
      className={cn(
        "relative inline-flex items-center gap-2 rounded-full px-7 py-3 sm:px-8 sm:py-3.5",
        "bg-white/60 backdrop-blur-xl backdrop-saturate-150",
        "font-display font-bold text-sm sm:text-base tracking-wide",
        "text-[#7A1145]",
        "shadow-[0_8px_32px_-4px_rgba(225,29,116,0.25),inset_0_0_0_1px_rgba(255,255,255,0.5)]",
        "transition-all duration-300 group-hover:shadow-[0_12px_40px_-4px_rgba(225,29,116,0.4),inset_0_0_0_1px_rgba(255,255,255,0.7)]",
      )}
    >
      <Sparkles className="w-4 h-4 text-[#E11D74]" strokeWidth={2.5} aria-hidden="true" />
      <span>{label}</span>
      <ArrowRight
        className="w-4 h-4 text-[#E8B84A] transition-transform duration-300 group-hover:translate-x-1"
        strokeWidth={2.5}
        aria-hidden="true"
      />
    </span>
  );

  const wrapperClasses = cn(
    "group relative inline-block rounded-full p-[2px]",
    "bg-[linear-gradient(135deg,#E11D74_0%,#C81E5C_45%,#E8B84A_100%)]",
    "shadow-[0_4px_24px_-2px_rgba(225,29,116,0.2)]",
    "transition-all duration-300 hover:scale-105 hover:shadow-[0_8px_32px_-2px_rgba(225,29,116,0.35)] active:scale-100",
    className,
  );

  if (href) {
    return (
      <a href={href} className={wrapperClasses}>
        {inner}
      </a>
    );
  }
  return (
    <Link to={to} className={wrapperClasses}>
      {inner}
    </Link>
  );
}

export default GlassCtaButton;
