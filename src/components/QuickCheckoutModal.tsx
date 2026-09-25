import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Zap, Loader2, Minus, Plus, X, ShieldCheck, Truck, Package } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useTracking } from "@/context/TrackingContext";
import { supabase } from "@/integrations/supabase/client";
import { resolveStorageImageUrl, STORAGE_PRODUCT_FALLBACK_URL } from "@/lib/storageImage";
import { toast } from "sonner";
import { PhoneInputIntl, COUNTRIES } from "@/components/PhoneInputIntl";
import { CountrySelectIntl } from "@/components/CountrySelectIntl";
import { GoogleSignInButton, OrDivider } from "@/components/auth/GoogleSignInButton";
import { FacebookSignInButton } from "@/components/auth/FacebookSignInButton";
import { useGeoLocation } from "@/hooks/useGeoLocation";
import { BinancePayModal } from "@/components/BinancePayModal";
import { BinanceLogo } from "@/components/BinanceLogo";
import type { Product } from "@/hooks/useProductData";

interface QuickCheckoutModalProps {
  product: Product;
  open: boolean;
  onClose: () => void;
}

export const QuickCheckoutModal = ({ product, open, onClose }: QuickCheckoutModalProps) => {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const { trackInitiateCheckout, trackAddPaymentInfo, trackPurchase } = useTracking();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [qty, setQty] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "binance">("cod");
  const [binanceOpen, setBinanceOpen] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<{
    orderId: string;
    orderNumber: string;
    guestToken: string | null;
  } | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: user?.email || "",
    phone: "",
    address: "",
    city: "",
    state: "",
    postal: "",
    country: "AE",
    countryName: "United Arab Emirates",
    notes: "",
  });
  const initiatedRef = useRef(false);
  const paymentInfoFiredRef = useRef(false);
  const countryManuallySetRef = useRef(false);
  const geo = useGeoLocation();

  // COD is available globally as an express checkout option.
  const codAllowed = true;

  // Auto-fill country from geo on first load (until user manually picks).
  useEffect(() => {
    if (!geo?.country || countryManuallySetRef.current) return;
    const match = COUNTRIES.find((c) => c.iso === geo.country.toUpperCase());
    if (match && form.country !== match.iso) {
      setForm((prev) => ({ ...prev, country: match.iso, countryName: match.name }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo?.country]);

  const subtotal = product.price * qty;
  const shipping = 0;
  const total = subtotal + shipping;

  // Fire InitiateCheckout once per modal open.
  useEffect(() => {
    if (!open) {
      initiatedRef.current = false;
      paymentInfoFiredRef.current = false;
      return;
    }
    if (initiatedRef.current) return;
    initiatedRef.current = true;
    trackInitiateCheckout(
      total,
      [
        {
          id: product.id,
          title: product.title,
          price: product.price,
          quantity: qty,
          category: product.category,
        },
      ],
      "USD",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fireAddPaymentInfo = () => {
    if (paymentInfoFiredRef.current) return;
    paymentInfoFiredRef.current = true;
    trackAddPaymentInfo(
      total,
      [
        {
          id: product.id,
          title: product.title,
          price: product.price,
          quantity: qty,
          category: product.category,
        },
      ],
      "USD",
    );
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (
      !paymentInfoFiredRef.current &&
      (e.target.name === "name" || e.target.name === "phone") &&
      e.target.value.trim().length > 0
    ) {
      fireAddPaymentInfo();
    }
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const rpcItems = [
        {
          product_id: product.id,
          variant_id: null,
          quantity: qty,
          image_url: product.image
            ? resolveStorageImageUrl(product.image, STORAGE_PRODUCT_FALLBACK_URL, "product-images")
            : null,
        },
      ];

      const { data: result, error } = await supabase.rpc("create_order", {
        p_items: rpcItems as any,
        p_shipping: {
          name: form.name,
          phone: form.phone,
          address: form.address,
          city: form.city,
          state: form.state,
          postal_code: form.postal,
          country: form.country,
          country_name: form.countryName,
          notes: form.notes,
        },
        p_email: form.email,
        p_coupon_code: undefined,
        p_payment_method: paymentMethod,
      });

      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = result as any;
      const orderId = res?.order_id as string;
      const orderNumber = (res?.order_number as string | undefined) || orderId;
      const guestToken = res?.guest_token as string | null;

      // Fire-and-forget: send order confirmation email via Resend
      supabase.functions.invoke("send-email", { body: { order_id: orderId } }).catch(() => {});

      if (paymentMethod === "binance") {
        // Open the Binance Pay modal; navigation happens after payment confirms.
        setPendingOrder({ orderId, orderNumber, guestToken });
        setBinanceOpen(true);
        toast.success("Order created — complete payment with Binance Pay");
        return;
      }

      // Funnel: Purchase event (COD path fires immediately)
      trackPurchase(
        orderId,
        Number(total.toFixed(2)),
        [
          {
            id: product.id,
            title: product.title,
            price: product.price,
            quantity: qty,
            category: product.category,
          },
        ],
        "USD",
      );

      toast.success("⚡ Order placed instantly! 🎉");
      onClose();
      navigate({
        to: "/thank-you",
        search: guestToken ? { order: orderNumber, token: guestToken } : { order: orderNumber },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    } catch (err: unknown) {
      toast.error((err instanceof Error ? err.message : String(err)) || "Failed to place order");
    } finally {
      setLoading(false);
    }
  };

  const handleBinancePaid = () => {
    if (!pendingOrder) return;
    trackPurchase(
      pendingOrder.orderId,
      Number(total.toFixed(2)),
      [
        {
          id: product.id,
          title: product.title,
          price: product.price,
          quantity: qty,
          category: product.category,
        },
      ],
      "USD",
    );
    const { orderNumber, guestToken } = pendingOrder;
    setBinanceOpen(false);
    setPendingOrder(null);
    onClose();
    navigate({
      to: "/thank-you",
      search: guestToken ? { order: orderNumber, token: guestToken } : { order: orderNumber },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  };

  const inputClass =
    "w-full px-3.5 py-3 rounded-xl border border-border bg-background/60 backdrop-blur-sm text-base sm:text-sm font-medium text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all";

  const labelClass =
    "block text-[11px] font-display font-semibold uppercase tracking-wider text-muted-foreground mb-1.5";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-w-2xl p-0 overflow-hidden gap-0 border-primary/30 shadow-[0_0_60px_-10px_hsl(var(--primary)/0.5)] bg-gradient-to-b from-background via-background to-primary/[0.02] max-h-[92vh] flex flex-col [&>button:last-child]:hidden">
        {/* Header */}
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-border/60 bg-gradient-to-br from-amber-500/15 via-orange-500/8 to-transparent relative overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.15),transparent_60%)] pointer-events-none" />
          <DialogTitle className="flex items-center gap-3 font-display text-base sm:text-lg relative pr-8">
            <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-[0_0_20px_-3px_rgba(251,146,60,0.8)] ring-1 ring-orange-300/40 shrink-0">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white fill-white" />
            </span>
            <div className="flex flex-col min-w-0">
              <span className="font-bold leading-tight">1-Click Order</span>
              <span className="text-[10px] sm:text-[11px] font-normal text-muted-foreground tracking-wide truncate">
                Express checkout · Cash on Delivery
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-0 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted active:scale-95 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </DialogTitle>
        </DialogHeader>

        {/* Product summary strip */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 sm:gap-4 border-b border-border/60 bg-muted/20 shrink-0">
          <img
            src={product.image}
            alt={product.title}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover bg-muted shrink-0 ring-1 ring-border shadow-sm"
            loading="lazy"
          />
          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold text-xs sm:text-sm text-foreground truncate">
              {product.title}
            </p>
            <p className="font-display font-bold text-primary text-sm sm:text-base mt-0.5">
              {formatPrice(product.price, product.currency)}
            </p>
          </div>
          <div className="flex items-center gap-1 bg-background rounded-xl border border-border p-1 shadow-sm shrink-0">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="w-8 h-8 sm:w-7 sm:h-7 rounded-lg hover:bg-primary/10 hover:text-primary flex items-center justify-center transition-colors touch-manipulation"
              aria-label="Decrease quantity"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-7 sm:w-8 text-center text-sm font-display font-bold">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => q + 1)}
              className="w-8 h-8 sm:w-7 sm:h-7 rounded-lg hover:bg-primary/10 hover:text-primary flex items-center justify-center transition-colors touch-manipulation"
              aria-label="Increase quantity"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0">
          {/* Form fields */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-3.5 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className={labelClass}>Full Name *</label>
                <input
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className={inputClass}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className={labelClass}>Phone *</label>
                <PhoneInputIntl
                  value={form.phone}
                  onChange={(v) => setForm((prev) => ({ ...prev, phone: v }))}
                  onFirstInput={fireAddPaymentInfo}
                  required
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Country *</label>
              <CountrySelectIntl
                value={form.country}
                onChange={(iso, c) => {
                  countryManuallySetRef.current = true;
                  setForm((prev) => ({ ...prev, country: iso, countryName: c.name }));
                }}
              />
            </div>

            <div>
              <label className={labelClass}>Delivery Address *</label>
              <input
                name="address"
                type="text"
                value={form.address}
                onChange={handleChange}
                required
                className={inputClass}
                placeholder="House, Road, Area"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className={labelClass}>City *</label>
                <input
                  name="city"
                  type="text"
                  value={form.city}
                  onChange={handleChange}
                  required
                  className={inputClass}
                  placeholder="e.g., New York, Dubai"
                />
              </div>
              <div>
                <label className={labelClass}>State / Region</label>
                <input
                  name="state"
                  type="text"
                  value={form.state}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Postal / ZIP Code</label>
              <input
                name="postal"
                type="text"
                value={form.postal}
                onChange={handleChange}
                className={inputClass}
                placeholder="Optional"
              />
            </div>

            <div>
              <label className={labelClass}>Notes (optional)</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={2}
                className={`${inputClass} resize-none`}
                placeholder="Any special instructions..."
              />
            </div>

            <div>
              <label className={labelClass}>Email *</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                className={inputClass}
                placeholder="you@example.com"
              />
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                Required — we'll send your order confirmation here.
              </p>
            </div>

            {!user && (
              <div>
                <OrDivider label="or sign up with" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <GoogleSignInButton />
                  <FacebookSignInButton />
                </div>
              </div>
            )}

            {/* Payment Method */}
            <div>
              <label className={labelClass}>Payment Method *</label>
              <div className="grid grid-cols-1 gap-2">
                {codAllowed && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("cod")}
                    className={`w-full text-left rounded-xl border-2 px-3 py-2.5 transition-colors ${
                      paymentMethod === "cod"
                        ? "border-green-500 bg-green-500/10"
                        : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">💵</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-display font-semibold">Cash on Delivery</p>
                        <p className="text-[10px] text-muted-foreground">
                          Pay when your order arrives (Bangladesh only)
                        </p>
                      </div>
                    </div>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPaymentMethod("binance")}
                  className={`w-full text-left rounded-xl border-2 px-3 py-2.5 transition-colors ${
                    paymentMethod === "binance"
                      ? "border-[#F0B90B] bg-[#F0B90B]/10"
                      : "border-border hover:border-muted-foreground/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex w-8 h-8 items-center justify-center rounded-md bg-white ring-1 ring-[#F0B90B]/40 shrink-0">
                      <BinanceLogo className="w-5 h-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-display font-semibold">Pay with Binance Pay</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        Crypto · USDT auto-converted from {formatPrice(total, product.currency)}
                      </p>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wide bg-[#F0B90B] text-black px-1.5 py-0.5 rounded shrink-0">
                      Crypto
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Trust badges */}
          <div className="px-4 sm:px-6 pb-3 sm:pb-4 grid grid-cols-3 gap-1.5 sm:gap-2">
            {[
              { icon: ShieldCheck, label: "Secure" },
              { icon: Truck, label: "Free Delivery" },
              { icon: Package, label: "Easy Return" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center justify-center sm:justify-start gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1.5 sm:py-2 rounded-lg bg-muted/40 border border-border/60"
              >
                <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground truncate">
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Total + Actions */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-border/60 bg-gradient-to-b from-muted/20 to-muted/40 space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Subtotal ({qty} item{qty > 1 ? "s" : ""})
                </span>
                <span className="font-display font-semibold text-foreground">
                  {formatPrice(subtotal, product.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Shipping</span>
                <span className="font-display font-semibold text-green-600">FREE</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/60">
                <span className="text-sm font-display font-semibold text-foreground">
                  Total ({paymentMethod === "binance" ? "Binance Pay" : "COD"})
                </span>
                <span className="font-display font-bold text-lg sm:text-xl bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
                  {formatPrice(total, product.currency)}
                </span>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 rounded-xl border border-border bg-background text-sm font-medium hover:bg-secondary transition-colors flex items-center justify-center gap-1.5 touch-manipulation"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 text-white text-sm font-display font-bold tracking-wide shadow-[0_0_25px_-5px_rgba(251,146,60,0.7)] hover:shadow-[0_0_35px_-3px_rgba(251,146,60,1)] hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 ring-1 ring-orange-300/30 touch-manipulation"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-white" />
                    Place Order Now
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
      <BinancePayModal
        open={binanceOpen}
        onClose={() => setBinanceOpen(false)}
        orderId={pendingOrder?.orderId ?? null}
        guestToken={pendingOrder?.guestToken ?? null}
        fiatAmount={total}
        fiatCurrency="USD"
        onPaid={handleBinancePaid}
      />
    </Dialog>
  );
};
