import { useEffect, useState } from "react";

type OverridePayload = { show: boolean | null };

export function emitBrandSplashOverride(show: boolean | null) {
  window.dispatchEvent(
    new CustomEvent<OverridePayload>("brand-splash:override", { detail: { show } }),
  );
}

export function BrandSplashDevPanel({ isAdmin }: { isAdmin: boolean }) {
  const [held, setHeld] = useState(false);
  const [flashing, setFlashing] = useState(false);

  if (!import.meta.env.DEV || isAdmin) return null;

  const showFor = (ms: number) => {
    setFlashing(true);
    emitBrandSplashOverride(true);
    window.setTimeout(() => {
      emitBrandSplashOverride(null);
      setFlashing(false);
    }, ms);
  };

  const toggleHold = () => {
    const next = !held;
    setHeld(next);
    emitBrandSplashOverride(next ? true : null);
  };

  const resetCache = async () => {
    try {
      sessionStorage.removeItem("has_seen_brand_splash");
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith("brand_splash_"))
        .forEach((k) => sessionStorage.removeItem(k));
      Object.keys(localStorage)
        .filter((k) => k.startsWith("brand_splash_"))
        .forEach((k) => localStorage.removeItem(k));
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } finally {
      window.location.reload();
    }
  };

  const btn =
    "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors disabled:opacity-50";

  return (
    <div
      style={{ position: "fixed", left: 12, bottom: 12, zIndex: 10000 }}
      className="flex items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-2 shadow-lg backdrop-blur"
    >
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Splash Dev
      </span>
      <button
        type="button"
        onClick={() => showFor(3000)}
        disabled={flashing || held}
        className={`${btn} border-primary/40 bg-primary/10 text-primary hover:bg-primary/20`}
      >
        Show 3s
      </button>
      <button
        type="button"
        onClick={toggleHold}
        className={`${btn} ${
          held
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-muted text-foreground hover:bg-muted/70"
        }`}
      >
        {held ? "Holding…" : "Hold"}
      </button>
      <button
        type="button"
        onClick={resetCache}
        className={`${btn} border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20`}
      >
        Reset cache
      </button>
    </div>
  );
}
