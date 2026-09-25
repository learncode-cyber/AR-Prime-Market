import { createContext, useContext, useCallback, type ReactNode } from "react";

interface ProductData {
  id: string;
  title: string;
  price: number;
  category?: string;
  currency?: string;
  quantity?: number;
}

interface TrackingContextType {
  trackAddToCart: (product: ProductData) => void;
  trackInitiateCheckout: (value: number, items: ProductData[], currency?: string) => void;
  trackAddPaymentInfo: (value: number, items: ProductData[], currency?: string) => void;
  trackPurchase: (orderId: string, value: number, items: ProductData[], currency?: string) => void;
  trackViewContent: (product: ProductData) => void;
  trackSearch: (query: string) => void;
  trackCompleteRegistration: () => void;
}

const noop: TrackingContextType = {
  trackAddToCart: () => {},
  trackInitiateCheckout: () => {},
  trackAddPaymentInfo: () => {},
  trackPurchase: () => {},
  trackViewContent: () => {},
  trackSearch: () => {},
  trackCompleteRegistration: () => {},
};

const TrackingContext = createContext<TrackingContextType>(noop);

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fbq: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _fbq: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gtag: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dataLayer: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ttq: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    snaptr: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pintrk: any;
  }
}

const DEFAULT_CURRENCY = "USD";

export const TrackingProvider = ({ children }: { children: ReactNode }) => {
  const trackAddToCart = useCallback((product: ProductData) => {
    if (typeof window === "undefined") return;
    const currency = product.currency || DEFAULT_CURRENCY;
    if (window.gtag) {
      window.gtag("event", "add_to_cart", {
        currency,
        value: product.price,
        items: [
          {
            item_id: product.id,
            item_name: product.title,
            item_category: product.category || "",
            price: product.price,
            quantity: product.quantity || 1,
          },
        ],
      });
    }
    if (window.fbq) {
      window.fbq("track", "AddToCart", {
        content_ids: [product.id],
        content_name: product.title,
        content_type: "product",
        value: product.price,
        currency,
      });
    }
    if (window.ttq) {
      window.ttq.track("AddToCart", {
        content_id: product.id,
        content_name: product.title,
        value: product.price,
        currency,
        quantity: product.quantity || 1,
      });
    }
  }, []);

  const trackInitiateCheckout = useCallback(
    (value: number, items: ProductData[], currency?: string) => {
      if (typeof window === "undefined") return;
      const ccy = currency || DEFAULT_CURRENCY;
      const contentIds = items.map((i) => i.id);
      if (window.gtag) {
        window.gtag("event", "begin_checkout", {
          currency: ccy,
          value,
          items: items.map((i) => ({
            item_id: i.id,
            item_name: i.title,
            price: i.price,
            quantity: i.quantity || 1,
          })),
        });
      }
      if (window.fbq) {
        window.fbq("track", "InitiateCheckout", {
          content_ids: contentIds,
          content_type: "product",
          value,
          currency: ccy,
          num_items: items.reduce((a, i) => a + (i.quantity || 1), 0),
        });
      }
      if (window.ttq) {
        window.ttq.track("InitiateCheckout", {
          contents: items.map((i) => ({
            content_id: i.id,
            content_name: i.title,
            quantity: i.quantity || 1,
            price: i.price,
          })),
          value,
          currency: ccy,
        });
      }
    },
    [],
  );

  const trackAddPaymentInfo = useCallback(
    (value: number, items: ProductData[], currency?: string) => {
      if (typeof window === "undefined") return;
      const ccy = currency || DEFAULT_CURRENCY;
      if (window.gtag) {
        window.gtag("event", "add_payment_info", {
          currency: ccy,
          value,
          items: items.map((i) => ({
            item_id: i.id,
            item_name: i.title,
            price: i.price,
            quantity: i.quantity || 1,
          })),
        });
      }
      if (window.fbq) {
        window.fbq("track", "AddPaymentInfo", {
          content_ids: items.map((i) => i.id),
          value,
          currency: ccy,
        });
      }
      if (window.ttq) {
        window.ttq.track("AddPaymentInfo", { value, currency: ccy });
      }
    },
    [],
  );

  const trackPurchase = useCallback(
    (orderId: string, value: number, items: ProductData[], currency?: string) => {
      if (typeof window === "undefined") return;
      const ccy = currency || DEFAULT_CURRENCY;
      if (window.gtag) {
        window.gtag("event", "purchase", {
          transaction_id: orderId,
          currency: ccy,
          value,
          items: items.map((i) => ({
            item_id: i.id,
            item_name: i.title,
            price: i.price,
            quantity: i.quantity || 1,
          })),
        });
      }
      if (window.fbq) {
        window.fbq("track", "Purchase", {
          content_ids: items.map((i) => i.id),
          content_type: "product",
          value,
          currency: ccy,
          order_id: orderId,
        });
      }
      if (window.ttq) {
        window.ttq.track("CompletePayment", {
          contents: items.map((i) => ({
            content_id: i.id,
            content_name: i.title,
            quantity: i.quantity || 1,
            price: i.price,
          })),
          value,
          currency: ccy,
          order_id: orderId,
        });
      }
    },
    [],
  );

  const trackViewContent = useCallback((product: ProductData) => {
    if (typeof window === "undefined") return;
    const currency = product.currency || DEFAULT_CURRENCY;
    if (window.gtag) {
      window.gtag("event", "view_item", {
        currency,
        value: product.price,
        items: [{ item_id: product.id, item_name: product.title, price: product.price }],
      });
    }
    if (window.fbq) {
      window.fbq("track", "ViewContent", {
        content_ids: [product.id],
        content_name: product.title,
        content_type: "product",
        value: product.price,
        currency,
      });
    }
    if (window.ttq) {
      window.ttq.track("ViewContent", {
        content_id: product.id,
        content_name: product.title,
        value: product.price,
        currency,
      });
    }
  }, []);

  const trackSearch = useCallback((query: string) => {
    if (typeof window === "undefined") return;
    if (window.gtag) window.gtag("event", "search", { search_term: query });
    if (window.fbq) window.fbq("track", "Search", { search_string: query });
    if (window.ttq) window.ttq.track("Search", { query });
  }, []);

  const trackCompleteRegistration = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.gtag) window.gtag("event", "sign_up");
    if (window.fbq) window.fbq("track", "CompleteRegistration");
    if (window.ttq) window.ttq.track("CompleteRegistration");
  }, []);

  return (
    <TrackingContext.Provider
      value={{
        trackAddToCart,
        trackInitiateCheckout,
        trackAddPaymentInfo,
        trackPurchase,
        trackViewContent,
        trackSearch,
        trackCompleteRegistration,
      }}
    >
      {children}
    </TrackingContext.Provider>
  );
};

export const useTracking = () => useContext(TrackingContext);
