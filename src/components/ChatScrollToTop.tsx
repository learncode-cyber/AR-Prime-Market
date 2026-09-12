import { useEffect, useState, type RefObject } from "react";
import { ArrowUp } from "lucide-react";

export const ChatScrollToTop = ({ scrollRef }: { scrollRef: RefObject<HTMLDivElement | null> }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setVisible(el.scrollTop > 150);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollRef]);

  const handleClick = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Scroll chat to top"
      className={`absolute bottom-4 right-4 z-20 p-2.5 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-[0_0_20px_-5px_hsl(var(--primary)/0.6)] border border-primary/30 backdrop-blur-md transition-all duration-300 hover:scale-110 hover:shadow-[0_0_28px_-5px_hsl(var(--primary)/0.85)] active:scale-90 ${
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto animate-fade-in"
          : "opacity-0 translate-y-3 pointer-events-none"
      }`}
    >
      <ArrowUp className="w-4 h-4" />
    </button>
  );
};
