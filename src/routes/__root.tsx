import { useEffect, useRef, useState } from "react";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/context/LanguageContext";
import { CurrencyProvider } from "@/context/CurrencyContext";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { TrackingProvider } from "@/context/TrackingContext";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CookieConsent } from "@/components/CookieConsent";
import { FloatingWhatsApp } from "@/components/FloatingWhatsApp";
import { PWARegister } from "@/components/PWARegister";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { MarketingTrackers } from "@/components/MarketingTrackers";

import { DynamicUIProvider } from "@/context/DynamicUIContext";
import { AiShoppingAgent } from "@/components/ai/AiShoppingAgent";
import { FakeOrderPopup } from "@/components/FakeOrderPopup";
import { BrandSplash } from "@/components/BrandSplash";

import { getSplashTimings, subscribeToNetworkChanges } from "@/lib/devicePerf";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground font-display">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "AR Prime Market — Premium Shopping" },
      {
        name: "description",
        content:
          "Premium products curated for the modern lifestyle by AR Qudrix. Quality, style, and value — delivered to your doorstep.",
      },
      { name: "author", content: "AR Qudrix" },
      { name: "publisher", content: "AR Qudrix" },
      { name: "copyright", content: "AR Qudrix" },
      { property: "og:site_name", content: "AR Prime Market — An AR Qudrix Company" },

      { name: "theme-color", content: "#e91e63" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "AR Prime" },
      { name: "mobile-web-app-capable", content: "yes" },
      { property: "og:title", content: "AR Prime Market — Premium Shopping" },
      {
        property: "og:description",
        content:
          "Premium products curated for the modern lifestyle. Quality, style, and value — delivered to your doorstep.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/icon-512.png" },
      { name: "twitter:title", content: "AR Prime Market — Premium Shopping" },
      {
        name: "twitter:description",
        content:
          "Premium products curated for the modern lifestyle. Quality, style, and value — delivered to your doorstep.",
      },
      { name: "twitter:image", content: "/icon-512.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "google-site-verification", content: "OuwB4AP9FEm5n_yuDtVVCZF0l5HDXdMu4dxp_MTsSnQ" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap",
      },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
    scripts: [
      {
        children: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${import.meta.env.VITE_META_PIXEL_ID || "YOUR_PIXEL_ID"}');fbq('track','PageView');`,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function useMinVisible(value: boolean, minMs: number) {
  const [held, setHeld] = useState(value);
  const onSince = useRef<number | null>(value ? Date.now() : null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (value) {
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      if (onSince.current === null) onSince.current = Date.now();
      setHeld(true);
    } else if (held) {
      const elapsed = onSince.current ? Date.now() - onSince.current : minMs;
      const wait = Math.max(0, minMs - elapsed);
      timer.current = window.setTimeout(() => {
        setHeld(false);
        onSince.current = null;
        timer.current = null;
      }, wait);
    }
    return () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [value, held, minMs]);

  return held;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const navState = useRouterState({
    select: (s) => {
      const pending = (s as unknown as { pendingMatches?: Array<{ pathname: string }> })
        .pendingMatches;
      return {
        pathname: s.location.pathname,
        status: s.status,
        isLoading: s.isLoading,
        pendingPath: pending?.[pending.length - 1]?.pathname ?? null,
      };
    },
  });
  const isAdmin = navState.pathname.startsWith("/kali_master");
  const pendingIsAdmin = navState.pendingPath?.startsWith("/kali_master") ?? false;
  const isRouteChanging = !!navState.pendingPath && navState.pendingPath !== navState.pathname;
  const isNavigating = navState.status === "pending" || navState.isLoading;

  const [timings, setTimings] = useState(() => getSplashTimings());
  useEffect(() => {
    const recompute = () => setTimings(getSplashTimings());
    return subscribeToNetworkChanges(recompute);
  }, []);

  // Safety cap: if navigation hangs longer than maxMs, treat as resolved.
  const [capExpired, setCapExpired] = useState(false);
  useEffect(() => {
    if (!isNavigating) {
      setCapExpired(false);
      return;
    }
    const t = window.setTimeout(() => setCapExpired(true), timings.maxMs);
    return () => window.clearTimeout(t);
  }, [isNavigating, timings.maxMs]);

  const wantsSplash = !isAdmin && !pendingIsAdmin && isRouteChanging && isNavigating && !capExpired;
  const showSplash = useMinVisible(wantsSplash, timings.minMs);

  const [devOverride, setDevOverride] = useState<boolean | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ show: boolean | null }>).detail;
      setDevOverride(detail?.show ?? null);
    };
    window.addEventListener("brand-splash:override", handler);
    return () => window.removeEventListener("brand-splash:override", handler);
  }, []);
  const effectiveShow = devOverride ?? showSplash;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <CurrencyProvider>
            <AuthProvider>
              <CartProvider>
                <TrackingProvider>
                  <DynamicUIProvider>
                    <Toaster />
                    <div className="min-h-screen flex flex-col">
                      {!isAdmin && <Navbar />}
                      <main className={`flex-1 ${isAdmin ? "" : "pt-14 sm:pt-16"}`}>
                        <Outlet />
                      </main>
                      {!isAdmin && <Footer />}
                      {!isAdmin && <FloatingWhatsApp />}

                      {!isAdmin && <AiShoppingAgent />}
                      {!isAdmin && <FakeOrderPopup />}
                      <CookieConsent />
                      <PWARegister />
                      {!isAdmin && <PWAInstallPrompt />}
                      <MarketingTrackers />
                      {!isAdmin && <BrandSplash show={effectiveShow} />}
                    </div>
                  </DynamicUIProvider>
                </TrackingProvider>
              </CartProvider>
            </AuthProvider>
          </CurrencyProvider>
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
