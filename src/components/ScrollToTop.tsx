import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";

export const ScrollToTop = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 200);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
      className={`fixed bottom-20 right-4 z-40 p-3 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-[0_0_25px_-5px_hsl(var(--primary)/0.6)] backdrop-blur-md border border-primary/30 transition-all duration-300 active:scale-90 touch-manipulation hover:scale-110 hover:shadow-[0_0_35px_-5px_hsl(var(--primary)/0.8)] ${
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto animate-fade-in"
          : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  );
};
