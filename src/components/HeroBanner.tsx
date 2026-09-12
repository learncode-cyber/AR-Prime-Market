import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useSectionContent } from "@/hooks/useSiteContent";
import heroFashion from "@/assets/hero-fashion.mp4.asset.json";
import heroElectronics from "@/assets/hero-electronics.mp4.asset.json";
import heroBeauty from "@/assets/hero-beauty.mp4.asset.json";
import { DEFAULT_HERO_VIDEO_POOL } from "@/lib/hero-videos";

interface Slide {
  title: string;
  subtitle: string;
  description: string;
  cta_text: string;
  cta_link: string;
  image: string;
  video?: string;
  badge: string;
  accent: string;
}

const defaultSlides: Slide[] = [
  {
    title: "New Season Collection",
    subtitle: "Up to 40% Off",
    description:
      "Discover our carefully curated collection of premium products at unbeatable prices.",
    cta_text: "Shop Now",
    cta_link: "/products",
    image:
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80&auto=format&fit=crop",
    video: heroFashion.url,
    badge: "🔥 Hot Deal",
    accent: "from-rose-900/80 via-rose-900/40",
  },
  {
    title: "Premium Electronics",
    subtitle: "Latest Gadgets",
    description: "Shop the latest electronics, gadgets, and accessories from top brands.",
    cta_text: "Explore Electronics",
    cta_link: "/products",
    image:
      "https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=1200&q=80&auto=format&fit=crop",
    video: heroElectronics.url,
    badge: "⚡ New Arrivals",
    accent: "from-slate-900/80 via-slate-900/40",
  },
  {
    title: "Beauty Essentials",
    subtitle: "Glow Up",
    description: "Premium beauty and makeup products curated for your daily ritual.",
    cta_text: "Shop Beauty",
    cta_link: "/products",
    image:
      "https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=1200&q=80&auto=format&fit=crop",
    video: heroBeauty.url,
    badge: "✨ Trending",
    accent: "from-rose-900/70 via-rose-900/30",
  },
];

export const HeroBanner = () => {
  const cmsData = useSectionContent<{ slides: Slide[] }>("hero_banner");
  const videoPool = DEFAULT_HERO_VIDEO_POOL;
  const rawSlides = cmsData?.slides?.length ? cmsData.slides : defaultSlides;
  const slides = rawSlides.map((s, i) => ({
    ...s,
    video: s.video || videoPool[i % videoPool.length],
  }));

  const [current, setCurrent] = useState(0);
  const next = useCallback(() => setCurrent((c) => (c + 1) % slides.length), [slides.length]);
  const prev = useCallback(
    () => setCurrent((c) => (c - 1 + slides.length) % slides.length),
    [slides.length],
  );

  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  const slide = slides[current];

  return (
    <section className="relative w-full aspect-[16/9] sm:aspect-[21/9] md:aspect-[2.8/1] overflow-hidden bg-secondary">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <div className="absolute inset-0 bg-muted animate-pulse" />
          {slide.video ? (
            <video
              src={slide.video}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster={slide.image}
              className="w-full h-full object-cover relative z-[1]"
            />
          ) : (
            <img
              src={slide.image}
              alt={slide.title}
              className="w-full h-full object-cover relative z-[1]"
              loading={current === 0 ? "eager" : "lazy"}
            />
          )}
          <div
            className={`absolute inset-0 bg-gradient-to-r ${slide.accent} to-transparent z-[2]`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10 z-[2]" />
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0 z-[3] flex items-end sm:items-center">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pb-10 sm:pb-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45, delay: 0.15 }}
              className="max-w-lg"
            >
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white text-[10px] sm:text-xs font-medium mb-3"
              >
                <Sparkles className="w-3 h-3" /> {slide.badge}
              </motion.span>
              <span className="block mb-2">
                <span className="inline-block px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-[10px] sm:text-xs font-semibold uppercase tracking-wider">
                  {slide.subtitle}
                </span>
              </span>
              <h1 className="font-display text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] mb-2 sm:mb-3 drop-shadow-lg">
                {slide.title}
              </h1>
              <p className="text-xs sm:text-sm md:text-base text-white/85 mb-5 sm:mb-6 leading-relaxed max-w-md drop-shadow">
                {slide.description}
              </p>
              <Link to="/products">
                <motion.span
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs sm:text-sm shadow-lg shadow-primary/30 transition-all hover:brightness-110 touch-manipulation"
                >
                  {slide.cta_text} <ArrowRight className="w-4 h-4" />
                </motion.span>
              </Link>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <button
        onClick={prev}
        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-[4] p-2.5 sm:p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white hover:bg-white/20 transition-colors touch-manipulation"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>
      <button
        onClick={next}
        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-[4] p-2.5 sm:p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white hover:bg-white/20 transition-colors touch-manipulation"
        aria-label="Next slide"
      >
        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      <div className="absolute bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 z-[4] flex gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`rounded-full transition-all duration-300 touch-manipulation ${i === current ? "w-7 h-2 bg-primary shadow-lg shadow-primary/40" : "w-2 h-2 bg-white/40 hover:bg-white/60"}`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
};
