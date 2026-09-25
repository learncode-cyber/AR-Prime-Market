import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { Product } from "@/hooks/useProductData";
import { supabase } from "@/integrations/supabase/client";
import { fireMetaEvent, getActiveCurrency } from "@/lib/metaPixel";
import { useCurrency } from "@/context/CurrencyContext";

export interface CartItem {
  product: Product;
  quantity: number;
  variantId?: string;
  variantLabel?: string;
  priceDelta?: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (
    product: Product,
    variant?: { id: string; label: string; priceDelta: number },
  ) => void;
  removeFromCart: (productId: string, variantId?: string) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  totalItems: number;
  /** USD-pivot value — display via `formatPrice(subtotal, "USD")`. */
  subtotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_KEY = "ar-pm-cart";
const SESSION_KEY = "ar-pm-session";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = localStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

function loadCartFromStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(CART_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(loadCartFromStorage);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { currencies, convertPrice } = useCurrency();

  // Converts a single item's line price (in ITS OWN product currency) to a
  // USD-equivalent. Cart totals are kept as a USD-pivot value rather than
  // "whatever the active display currency happens to be" so that: (a) a
  // cart mixing products priced in different currencies sums correctly
  // (raw-summing e.g. a $25 item + a ৳500 item is meaningless — this
  // converts each to USD first), and (b) the total doesn't need to be
  // recomputed on every currency switch — it's already pivot-based, so
  // `formatPrice(subtotal, "USD")` at any display site converts it
  // correctly to whatever currency the customer has selected.
  const lineToUsd = useCallback(
    (item: CartItem) => {
      const unit = item.product.price + (item.priceDelta || 0);
      const rate = currencies.find((c) => c.code === (item.product.currency || "USD"))?.rate ?? 1;
      return (unit / rate) * item.quantity;
    },
    [currencies],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    if (items.length === 0) return;

    persistTimer.current = setTimeout(async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const cartPayload = items.map((i) => ({
          id: i.product.id,
          title: i.product.title,
          image: i.product.image,
          price: i.product.price,
          currency: i.product.currency || "USD",
          quantity: i.quantity,
          variantId: i.variantId,
          variantLabel: i.variantLabel,
          priceDelta: i.priceDelta || 0,
        }));

        const subtotalVal = items.reduce((sum, i) => sum + lineToUsd(i), 0);

        await supabase.functions.invoke("cart-recovery", {
          body: {
            action: "persist_cart",
            user_id: session?.user?.id || null,
            session_id: getSessionId(),
            email: session?.user?.email || null,
            cart_items: cartPayload,
            subtotal: subtotalVal,
            currency: "USD",
          },
        });
      } catch (err) {
        console.debug("[CartPersist] failed:", err);
      }
    }, 2000);

    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [items, lineToUsd]);

  const cartKey = (productId: string, variantId?: string) => `${productId}::${variantId || "base"}`;

  const addToCart = (
    product: Product,
    variant?: { id: string; label: string; priceDelta: number },
  ) => {
    setItems((prev) => {
      const key = cartKey(product.id, variant?.id);
      const existing = prev.find((i) => cartKey(i.product.id, i.variantId) === key);
      if (existing) {
        return prev.map((i) =>
          cartKey(i.product.id, i.variantId) === key ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          variantId: variant?.id,
          variantLabel: variant?.label,
          priceDelta: variant?.priceDelta || 0,
        },
      ];
    });
    // Meta Pixel AddToCart — fires immediately with dynamic currency + event_id
    const rawUnitPrice = product.price + (variant?.priceDelta || 0);
    const unitPrice = convertPrice(rawUnitPrice, product.currency || "USD");
    fireMetaEvent("AddToCart", {
      content_name: product.title,
      content_ids: [product.id],
      content_type: "product",
      value: unitPrice,
      currency: getActiveCurrency(),
      contents: [{ id: product.id, quantity: 1, item_price: unitPrice }],
    });
  };

  const removeFromCart = (productId: string, variantId?: string) => {
    const key = cartKey(productId, variantId);
    setItems((prev) => prev.filter((i) => cartKey(i.product.id, i.variantId) !== key));
  };

  const updateQuantity = (productId: string, quantity: number, variantId?: string) => {
    if (quantity <= 0) {
      removeFromCart(productId, variantId);
      return;
    }
    const key = cartKey(productId, variantId);
    setItems((prev) =>
      prev.map((i) => (cartKey(i.product.id, i.variantId) === key ? { ...i, quantity } : i)),
    );
  };

  const clearCart = useCallback(async () => {
    setItems([]);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await supabase.functions.invoke("cart-recovery", {
        body: {
          action: "mark_recovered",
          user_id: session?.user?.id || null,
          session_id: getSessionId(),
        },
      });
    } catch {
      // silent
    }
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  // USD-pivot subtotal — see lineToUsd's comment above for why. Consumers
  // must display this via `formatPrice(subtotal, "USD")`, not
  // `formatPrice(subtotal)` assuming some other implicit currency.
  const subtotal = items.reduce((sum, i) => sum + lineToUsd(i), 0);

  return (
    <CartContext.Provider
      value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, subtotal }}
    >
      {children}
    </CartContext.Provider>
  );
};

const defaultCart: CartContextType = {
  items: [],
  addToCart: () => {},
  removeFromCart: () => {},
  updateQuantity: () => {},
  clearCart: async () => {},
  totalItems: 0,
  subtotal: 0,
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  return ctx ?? defaultCart;
};
