import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Package, Loader2, Truck, CheckCircle, Clock, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/context/CurrencyContext";
import { toast } from "sonner";

export const Route = createFileRoute("/track-order")({
  head: () => ({
    meta: [
      { title: "Track Order — AR Prime Market" },
      { name: "description", content: "Track your AR Prime Market order status." },
    ],
  }),
  component: TrackOrderPage,
});

interface OrderInfo {
  id: string;
  order_number: string | null;
  status: string;
  total_amount: number;
  created_at: string;
  currency: string | null;
  payment_method: string | null;
  guest_email: string | null;
}

interface OrderItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  image_url: string | null;
}

function TrackOrderPage() {
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { formatInCurrency } = useCurrency();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setOrder(null);
    setItems([]);
    try {
      // Search by order_number or by ID or by guest email
      const trimmed = query.trim();
      let data: OrderInfo | null = null;

      // Try order_number first
      const { data: byNumber } = await supabase
        .from("orders")
        .select(
          "id, order_number, status, total_amount, created_at, currency, payment_method, guest_email",
        )
        .eq("order_number", trimmed)
        .maybeSingle();

      if (byNumber) {
        data = byNumber as OrderInfo;
      } else {
        // Try by UUID
        const { data: byId } = await supabase
          .from("orders")
          .select(
            "id, order_number, status, total_amount, created_at, currency, payment_method, guest_email",
          )
          .eq("id", trimmed)
          .maybeSingle();
        if (byId) data = byId as OrderInfo;
      }

      if (!data) {
        // Try by guest email — show latest order
        const { data: byEmail } = await supabase
          .from("orders")
          .select(
            "id, order_number, status, total_amount, created_at, currency, payment_method, guest_email",
          )
          .eq("guest_email", trimmed)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (byEmail) data = byEmail as OrderInfo;
      }

      if (!data) {
        toast.error("Order not found. Try order number, ID, or email.");
        return;
      }

      setOrder(data);

      // Fetch items
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("id, title, quantity, unit_price, image_url")
        .eq("order_id", data.id);
      if (orderItems) setItems(orderItems);
    } catch {
      toast.error("Failed to find order");
    } finally {
      setLoading(false);
    }
  };

  const statusSteps = ["pending", "processing", "shipped", "delivered"];
  const currentStep = order ? statusSteps.indexOf(order.status) : -1;
  const isCancelled = order?.status === "cancelled" || order?.status === "refunded";

  const stepIcons = [
    <Clock className="w-4 h-4" key="pending" />,
    <Package className="w-4 h-4" key="processing" />,
    <Truck className="w-4 h-4" key="shipped" />,
    <CheckCircle className="w-4 h-4" key="delivered" />,
  ];

  return (
    <div className="min-h-screen bg-background">
      <section className="py-12 sm:py-16 bg-card/50 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-foreground">
            Track Your Order
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your order number, order ID, or email
          </p>
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <form onSubmit={handleSearch} className="flex gap-2 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ORD-20260415-xxxx or email..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Track"}
          </button>
        </form>

        {order && (
          <div className="space-y-4">
            {/* Order Info Card */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-xs text-muted-foreground">Order Number</p>
                  <p className="font-mono font-bold text-foreground">
                    {order.order_number || order.id.slice(0, 8)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="text-sm text-foreground">
                    {new Date(order.created_at).toLocaleDateString("en-US", {
                      dateStyle: "medium",
                    })}
                  </p>
                </div>
              </div>

              {/* Status Timeline */}
              {isCancelled ? (
                <div className="flex items-center justify-center gap-2 py-4 text-red-500">
                  <XCircle className="w-5 h-5" />
                  <span className="font-medium capitalize">{order.status}</span>
                </div>
              ) : (
                <div className="relative mb-6">
                  {/* Progress bar */}
                  <div className="absolute top-4 left-0 right-0 h-0.5 bg-secondary">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{
                        width: `${Math.max(0, (currentStep / (statusSteps.length - 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-start justify-between relative">
                    {statusSteps.map((step, i) => (
                      <div
                        key={step}
                        className="flex flex-col items-center"
                        style={{ width: "25%" }}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center z-10 transition-colors ${
                            i <= currentStep
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {stepIcons[i]}
                        </div>
                        <p
                          className={`text-[10px] mt-1.5 capitalize text-center ${i <= currentStep ? "text-primary font-medium" : "text-muted-foreground"}`}
                        >
                          {step}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Payment</p>
                  <p className="text-foreground capitalize">
                    {order.payment_method === "cod" ? "Cash on Delivery" : order.payment_method}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-foreground font-bold">
                    {formatInCurrency(order.total_amount, order.currency || "USD")}
                  </p>
                </div>
              </div>
            </div>

            {/* Order Items */}
            {items.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="font-display font-semibold text-sm text-foreground mb-3">
                  Order Items
                </h3>
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-3">
                      {item.image_url && (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="w-10 h-10 rounded-lg object-cover bg-secondary"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <p className="text-sm font-medium text-foreground shrink-0">
                        {formatInCurrency(item.unit_price * item.quantity, order.currency || "USD")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
