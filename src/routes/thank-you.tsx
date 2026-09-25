import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle, Package, Copy, ExternalLink, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/context/CurrencyContext";
import { toast } from "sonner";
import { fireMetaEvent } from "@/lib/metaPixel";

export const Route = createFileRoute("/thank-you")({
  head: () => ({
    meta: [
      { title: "Thank You — Order Confirmed | AR Prime Market" },
      {
        name: "description",
        content:
          "Your order has been placed successfully. Thank you for shopping with AR Prime Market.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    order: typeof search.order === "string" ? search.order : undefined,
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: ThankYouPage,
});

interface OrderData {
  id: string;
  order_number: string | null;
  status: string;
  total_amount: number;
  currency: string;
  created_at: string;
  shipping_address: string | null;
  payment_method: string;
  guest_email: string | null;
  estimated_delivery: string | null;
  user_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_country?: string | null;
  shipping_postal_code?: string | null;
}

const PAYMENT_LABELS: Record<string, string> = {
  cod: "Cash on Delivery",
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  binance: "Binance Pay",
  bank_transfer: "Bank Transfer",
  card: "Card",
};

interface OrderItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  image_url: string | null;
  variant_label: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ThankYouPage() {
  const { order: ref, token } = Route.useSearch();
  const { formatInCurrency } = useCurrency();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        if (token) {
          const { data } = await supabase.rpc("get_guest_order", { p_token: token });
          const row = Array.isArray(data) ? data[0] : null;
          if (row?.order_data) {
            setOrder(row.order_data as unknown as OrderData);
            setItems((row.items as unknown as OrderItem[]) || []);
          }
        } else if (ref) {
          const isUuid = UUID_RE.test(ref);
          const query = supabase
            .from("orders")
            .select(
              "id, order_number, status, total_amount, currency, created_at, shipping_address, payment_method, guest_email, estimated_delivery",
            )
            .limit(1);
          const { data: orderData } = isUuid
            ? await query.eq("id", ref).maybeSingle()
            : await query.eq("order_number", ref).maybeSingle();

          if (orderData) {
            setOrder(orderData as OrderData);
            const { data: itemsData } = await supabase
              .from("order_items")
              .select("id, title, quantity, unit_price, image_url, variant_label")
              .eq("order_id", (orderData as OrderData).id);
            if (itemsData) setItems(itemsData);
          }
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [ref, token]);

  useEffect(() => {
    if (!order) return;
    if (typeof window === "undefined") return;
    const dedupKey = `meta_capi_purchase_fired:${order.id}`;
    try {
      if (window.sessionStorage.getItem(dedupKey)) return;
      window.sessionStorage.setItem(dedupKey, "1");
    } catch {
      return;
    }
    const [firstName, ...rest] = (order.customer_name || "").trim().split(/\s+/);
    fireMetaEvent(
      "Purchase",
      {
        value: order.total_amount,
        currency: order.currency || "USD",
        order_id: order.id,
        content_type: "product",
        content_ids: items.map((i) => i.id),
        num_items: items.reduce((a, i) => a + i.quantity, 0),
        contents: items.map((i) => ({ id: i.id, quantity: i.quantity, item_price: i.unit_price })),
      },
      {
        userData: {
          email: order.customer_email || order.guest_email || undefined,
          phone: order.customer_phone || undefined,
          first_name: firstName,
          last_name: rest.join(" ") || undefined,
          city: order.shipping_city || undefined,
          state: order.shipping_state || undefined,
          country: order.shipping_country || undefined,
          zip: order.shipping_postal_code || undefined,
          external_id: order.user_id || undefined,
        },
      },
    );
  }, [order, items]);

  const copyOrderNumber = () => {
    const num = order?.order_number || order?.id;
    if (num) {
      navigator.clipboard.writeText(num);
      toast.success("Order number copied!");
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-foreground">
          Thank You! 🎉
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Your order has been placed successfully.
        </p>
        <Link
          to="/"
          className="inline-block mt-6 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  const shippingInfo = order.shipping_address ? JSON.parse(order.shipping_address) : null;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-foreground">
          Order Confirmed! 🎉
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Thank you for your order. We'll process it shortly.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Order Number</p>
            <p className="font-mono font-bold text-lg text-foreground">
              {order.order_number || order.id.slice(0, 8)}
            </p>
          </div>
          <button
            onClick={copyOrderNumber}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            <Copy className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Date</p>
            <p className="text-foreground">
              {new Date(order.created_at).toLocaleDateString("en-US", { dateStyle: "medium" })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Payment</p>
            <p className="text-foreground">
              {PAYMENT_LABELS[order.payment_method] ?? order.payment_method}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <span className="inline-flex px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-medium capitalize">
              {order.status}
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-foreground font-bold">
              {formatInCurrency(order.total_amount, order.currency)}
            </p>
          </div>
        </div>
      </div>

      {order.estimated_delivery && (
        <div className="rounded-2xl border border-border bg-card p-5 mb-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Estimated Delivery</p>
            <p className="text-foreground font-semibold">
              {new Date(order.estimated_delivery).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 mb-4">
          <h3 className="font-display font-semibold text-sm text-foreground mb-3">Order Items</h3>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3">
                {item.image_url && (
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-12 h-12 rounded-lg object-cover bg-secondary"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground font-medium truncate">{item.title}</p>
                  {item.variant_label && (
                    <p className="text-xs text-muted-foreground">{item.variant_label}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Qty: {item.quantity} × {formatInCurrency(item.unit_price, order.currency)}
                  </p>
                </div>
                <p className="text-sm font-medium text-foreground shrink-0">
                  {formatInCurrency(item.unit_price * item.quantity, order.currency)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {shippingInfo && (
        <div className="rounded-2xl border border-border bg-card p-5 mb-6">
          <h3 className="font-display font-semibold text-sm text-foreground mb-3">
            Shipping Address
          </h3>
          <div className="text-sm text-muted-foreground space-y-1">
            <p className="text-foreground font-medium">{shippingInfo.name}</p>
            <p>{shippingInfo.address}</p>
            <p>{shippingInfo.city}</p>
            <p>{shippingInfo.phone}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          to="/track-order"
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all"
        >
          <Package className="w-4 h-4" /> Track Order
        </Link>
        <Link
          to="/products"
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-secondary transition-colors"
        >
          <ExternalLink className="w-4 h-4" /> Continue Shopping
        </Link>
      </div>
    </div>
  );
}
