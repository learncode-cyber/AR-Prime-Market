import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

interface Settings {
  is_enabled: boolean;
  interval_seconds: number;
  display_seconds: number;
  names: string[];
  districts: string[];
}

interface MiniProduct {
  id: string;
  title: string;
  slug: string | null;
  image: string | null;
}

interface PopupData {
  key: number;
  name: string;
  district: string;
  product: MiniProduct;
}

const DEFAULTS: Settings = {
  is_enabled: true,
  interval_seconds: 45,
  display_seconds: 5,
  names: ["Abdullah", "Sadia", "Tanvir", "Mim"],
  districts: ["Dhaka", "Chittagong", "Sylhet", "Bogra"],
};

function pick<T>(arr: T[]): T | undefined {
  if (!arr.length) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const k = "fo_sid";
    let v = sessionStorage.getItem(k);
    if (!v) {
      v = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)) as string;
      sessionStorage.setItem(k, v);
    }
    return v;
  } catch {
    return "";
  }
}

export function FakeOrderPopup() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = pathname.startsWith("/kali_master");

  const [settings, setSettings] = useState<Settings | null>(null);
  const [products, setProducts] = useState<MiniProduct[]>([]);
  const [popup, setPopup] = useState<PopupData | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cycleTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const keyRef = useRef(0);

  const logEvent = (event_type: "impression" | "dismiss", data: PopupData) => {
    try {
      (supabase as any)
        .from("fake_order_events")
        .insert({
          event_type,
          name: data.name,
          district: data.district,
          product_id: data.product.id,
          product_title: data.product.title,
          path: typeof window !== "undefined" ? window.location.pathname : null,
          session_id: getSessionId(),
        })
        .then(() => {});
    } catch {
      // swallow analytics errors
    }
  };

  useEffect(() => {
    if (isAdmin) return;
    let cancelled = false;
    (async () => {
      const [{ data: s }, { data: p }] = await Promise.all([
        (supabase as any)
          .from("fake_order_settings")
          .select("is_enabled, interval_seconds, display_seconds, names, districts")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("products")
          .select("id, title, slug, gallery_urls")
          .eq("is_active", true)
          .limit(40),
      ]);
      if (cancelled) return;
      setSettings(s ? { ...DEFAULTS, ...s } : DEFAULTS);
      setProducts(
        (p || []).map((row: any) => ({
          id: row.id,
          title: row.title,
          slug: row.slug ?? null,
          image:
            Array.isArray(row.gallery_urls) && row.gallery_urls.length > 0
              ? row.gallery_urls[0]
              : null,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) return;
    if (!settings || !settings.is_enabled) return;
    if (!products.length || !settings.names.length || !settings.districts.length) return;

    const isModalOpen = () =>
      typeof document !== "undefined" &&
      !!document.querySelector(
        '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
      );

    const showOne = () => {
      if (document.hidden) return;
      // Hide while the user is busy in a modal / 1-click order / checkout form.
      if (isModalOpen()) {
        setPopup(null);
        return;
      }
      const name = pick(settings.names);
      const district = pick(settings.districts);
      const product = pick(products);
      if (!name || !district || !product) return;
      keyRef.current += 1;
      const data: PopupData = { key: keyRef.current, name, district, product };
      setPopup(data);
      logEvent("impression", data);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(
        () => setPopup(null),
        Math.max(2, settings.display_seconds) * 1000,
      );
    };

    // first popup after a short delay so it doesn't appear on initial paint
    const initial = setTimeout(showOne, 8000);
    cycleTimer.current = setInterval(showOne, Math.max(10, settings.interval_seconds) * 1000);
    return () => {
      clearTimeout(initial);
      if (cycleTimer.current) clearInterval(cycleTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [isAdmin, settings, products]);

  // If a dialog/modal opens while a popup is on screen, dismiss it immediately
  // so it can never overlap or distract from a checkout form.
  useEffect(() => {
    if (!popup || typeof document === "undefined") return;
    const check = () => {
      const open = document.querySelector(
        '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
      );
      if (open) setPopup(null);
    };
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, {
      subtree: true,
      attributes: true,
      childList: true,
      attributeFilter: ["data-state"],
    });
    return () => obs.disconnect();
  }, [popup]);

  if (isAdmin || !popup) return null;

  return (
    <div
      key={popup.key}
      className="fixed bottom-4 left-4 z-[60] max-w-[320px] animate-in slide-in-from-left-4 fade-in duration-500"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card/95 backdrop-blur px-3 py-2.5 shadow-lg">
        {popup.product.image ? (
          <img
            src={popup.product.image}
            alt=""
            loading="lazy"
            className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="h-12 w-12 rounded-lg bg-muted flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-foreground leading-snug">
            <span className="font-semibold">{popup.name}</span> from{" "}
            <span className="font-semibold">{popup.district}</span> just purchased{" "}
            <span className="font-semibold line-clamp-1 inline">{popup.product.title}</span>! 🔥
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">a few seconds ago</p>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            logEvent("dismiss", popup);
            setPopup(null);
          }}
          className="text-muted-foreground hover:text-foreground flex-shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
