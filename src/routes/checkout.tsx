import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCheckout } from "@/hooks/useCheckout";
import { ADDRESS_CONFIGS, COUNTRY_FLAGS } from "@/config/addressConfig";
import { CountrySelectIntl } from "@/components/CountrySelectIntl";
import { COUNTRIES } from "@/components/PhoneInputIntl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, MapPin, Plus, Check, Truck } from "lucide-react";
import { estimateShipping } from "@/lib/shippingEstimate";
import { useMemo, useEffect, useRef, useState } from "react";
import { fireMetaEvent, getActiveCurrency } from "@/lib/metaPixel";
import { BinancePayModal } from "@/components/BinancePayModal";
import { BinanceLogo } from "@/components/BinanceLogo";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — AR Prime Market" },
      { name: "description", content: "Complete your order with secure international checkout." },
    ],
  }),
  component: CheckoutPage,
});

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-500 mt-1">{msg}</p>;
}

function CheckoutPage() {
  const navigate = useNavigate();
  const {
    formData,
    setFormData,
    errors,
    isSubmitting,
    orderSuccess,
    config,
    isBangladesh,
    cartItems,
    selectedCountry,
    handleCountryChange,
    handlePhonePrefixChange,
    handleSubmit,
    addresses,
    selectedAddressId,
    selectAddress,
    clearSelectedAddress,
  } = useCheckout();

  const [binanceOpen, setBinanceOpen] = useState(false);
  const [binancePaid, setBinancePaid] = useState(false);
  useEffect(() => {
    if (orderSuccess && formData.paymentMethod === "binance" && !binancePaid) {
      setBinanceOpen(true);
    }
  }, [orderSuccess, formData.paymentMethod, binancePaid]);

  const subtotal = cartItems.reduce((s, it) => s + it.retail_price * it.quantity, 0);

  // Meta Pixel InitiateCheckout — fires once per checkout mount with current basket
  const checkoutFiredRef = useRef(false);
  useEffect(() => {
    if (checkoutFiredRef.current) return;
    if (!cartItems || cartItems.length === 0) return;
    checkoutFiredRef.current = true;
    fireMetaEvent("InitiateCheckout", {
      value: subtotal,
      currency: getActiveCurrency(),
      num_items: cartItems.reduce((a, i) => a + i.quantity, 0),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content_ids: cartItems.map((i: any) => i.product_id ?? i.id),
      content_type: "product",
    });
  }, [cartItems, subtotal]);

  const estimate = useMemo(
    () =>
      estimateShipping({
        country: selectedCountry,
        state: formData.shippingState,
        city: formData.shippingCity,
        postal: formData.shippingPostal,
        subtotal,
      }),
    [
      selectedCountry,
      formData.shippingState,
      formData.shippingCity,
      formData.shippingPostal,
      subtotal,
    ],
  );

  const shipping_fee = estimate.cost;
  const total = subtotal + shipping_fee;
  const currencySymbol = config.currency === "BDT" ? "৳" : "$";
  const fmt = (n: number) => `${currencySymbol}${n.toFixed(2)}`;

  const upd = <K extends keyof typeof formData>(key: K, val: (typeof formData)[K]) =>
    setFormData((p) => ({ ...p, [key]: val }));

  if (orderSuccess && (formData.paymentMethod !== "binance" || binancePaid)) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Card className="text-center">
          <CardContent className="pt-10 pb-8 space-y-4">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-500" />
            <h1 className="text-2xl font-bold">Order Placed Successfully!</h1>
            <p className="text-muted-foreground">
              Order{" "}
              <span className="font-mono font-semibold text-foreground">
                #{orderSuccess.order_number}
              </span>
            </p>
            {orderSuccess.channel === "steadfast" && (
              <div className="space-y-1">
                <p className="text-sm">Your order is dispatched via SteadFast Courier.</p>
                {orderSuccess.tracking_number && (
                  <p className="text-xs text-muted-foreground">
                    Tracking: <span className="font-mono">{orderSuccess.tracking_number}</span>
                  </p>
                )}
              </div>
            )}
            {orderSuccess.channel === "cj_dropshipping" && (
              <p className="text-sm">Your order is being processed for international shipping.</p>
            )}
            {orderSuccess.channel === "manual" && (
              <p className="text-sm">Your order is confirmed. We will contact you shortly.</p>
            )}
            <Button className="mt-4" onClick={() => navigate({ to: "/products" })}>
              Continue Shopping
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <h2 className="font-display font-bold text-xl">Your cart is empty</h2>
        <Link to="/products" className="mt-4 text-primary hover:underline text-sm">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="font-display font-bold text-2xl mb-6">Checkout</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-8">
        {/* LEFT — Form */}
        <div className="space-y-6 order-2 lg:order-1">
          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="checkout-name">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="checkout-name"
                  value={formData.customerName}
                  onChange={(e) => upd("customerName", e.target.value)}
                  placeholder="John Doe"
                />
                <FieldError msg={errors.customerName} />
              </div>
              <div>
                <Label htmlFor="checkout-email">Email</Label>
                <Input
                  id="checkout-email"
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => upd("customerEmail", e.target.value)}
                  placeholder="you@example.com"
                />
                <p className="text-xs text-muted-foreground mt-1">Optional for COD orders</p>
              </div>
              <div>
                <Label htmlFor="checkout-phone">
                  Phone Number <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-2">
                  <div className="w-32">
                    <Select value={formData.countryCode} onValueChange={handlePhonePrefixChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c.iso} value={c.dial}>
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className={`fi fi-${c.iso.toLowerCase()} rounded-sm shadow-sm`}
                                style={{ width: "1.1rem", height: "0.8rem" }}
                                aria-hidden="true"
                              />
                              <span className="tabular-nums">{c.dial}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    id="checkout-phone"
                    className="flex-1"
                    inputMode="numeric"
                    value={formData.customerPhone}
                    onChange={(e) => upd("customerPhone", e.target.value.replace(/[^\d]/g, ""))}
                    placeholder={isBangladesh ? "1712345678" : "5xxxxxxxx"}
                  />
                </div>
                <FieldError msg={errors.customerPhone} />
              </div>
            </CardContent>
          </Card>

          {/* Saved addresses */}
          {addresses.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Shipping to
                </CardTitle>
                <Link to="/account" className="text-xs text-primary hover:underline">
                  Manage addresses
                </Link>
              </CardHeader>
              <CardContent className="space-y-2">
                {addresses.map((a) => {
                  const active = a.id === selectedAddressId;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => selectAddress(a.id)}
                      className={`w-full text-left rounded-xl border-2 p-3 transition-colors ${
                        active
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/40"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}
                        >
                          {active && <Check className="w-3 h-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">
                              {a.label || a.full_name || "Saved address"}
                            </p>
                            {a.is_default && (
                              <Badge variant="secondary" className="text-[10px] h-4">
                                Default
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {[a.line1, a.line2, a.city, a.state, a.postal_code, a.country_name]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                          {a.phone && (
                            <p className="text-xs text-muted-foreground mt-0.5">{a.phone}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={clearSelectedAddress}
                  className={`w-full text-left rounded-xl border-2 p-3 transition-colors ${
                    selectedAddressId === null
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/40"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm">
                    <Plus className="w-4 h-4" />
                    <span className="font-medium">Use a different address</span>
                  </div>
                </button>
              </CardContent>
            </Card>
          )}

          {/* Shipping */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Shipping Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Country</Label>
                <CountrySelectIntl
                  value={selectedCountry}
                  onChange={(iso) => handleCountryChange(iso)}
                />
              </div>

              {isBangladesh && (
                <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-2.5 text-sm text-green-700 dark:text-green-300">
                  🇧🇩 Cash on Delivery only · Pay when package arrives
                </div>
              )}

              <div>
                <Label htmlFor="checkout-line1">
                  {config.fields.line1.label} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="checkout-line1"
                  value={formData.shippingLine1}
                  onChange={(e) => upd("shippingLine1", e.target.value)}
                  placeholder={config.fields.line1.placeholder}
                />
                <FieldError msg={errors.shippingLine1} />
              </div>

              <div>
                <Label htmlFor="checkout-line2">
                  {config.fields.line2.label}{" "}
                  <span className="text-muted-foreground text-xs">(Optional)</span>
                </Label>
                <Input
                  id="checkout-line2"
                  value={formData.shippingLine2}
                  onChange={(e) => upd("shippingLine2", e.target.value)}
                  placeholder={config.fields.line2.placeholder}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="checkout-city">
                    {(config.fields.city as any).label} <span className="text-red-500">*</span>
                  </Label>
                  {(config.fields.city as any).type === "select" ? (
                    <Select
                      value={formData.shippingCity}
                      onValueChange={(v) => upd("shippingCity", v)}
                    >
                      <SelectTrigger id="checkout-city">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {((config.fields.city as any).options as string[]).map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="checkout-city"
                      value={formData.shippingCity}
                      onChange={(e) => upd("shippingCity", e.target.value)}
                      placeholder={(config.fields.city as any).placeholder}
                    />
                  )}
                  <FieldError msg={errors.shippingCity} />
                </div>

                <div>
                  <Label htmlFor="checkout-state">
                    {config.fields.state.label}
                    {(config.fields.state as any).required && (
                      <span className="text-red-500"> *</span>
                    )}
                  </Label>
                  {(config.fields.state as any).type === "select" ? (
                    <Select
                      value={formData.shippingState}
                      onValueChange={(v) => upd("shippingState", v)}
                    >
                      <SelectTrigger id="checkout-state">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {((config.fields.state as any).options as string[]).map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="checkout-state"
                      value={formData.shippingState}
                      onChange={(e) => upd("shippingState", e.target.value)}
                      placeholder={(config.fields.state as any).placeholder || ""}
                    />
                  )}
                  <FieldError msg={errors.shippingState} />
                </div>
              </div>

              {selectedCountry !== "AE" && (
                <div>
                  <Label htmlFor="checkout-postal">
                    {config.fields.postal.label}
                    {!config.fields.postal.required && (
                      <span className="text-muted-foreground text-xs"> (Optional)</span>
                    )}
                  </Label>
                  <Input
                    id="checkout-postal"
                    value={formData.shippingPostal}
                    onChange={(e) => upd("shippingPostal", e.target.value)}
                    placeholder={config.fields.postal.placeholder}
                  />
                  <FieldError msg={errors.shippingPostal} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment Method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {config.paymentMethods.includes("cod") && (
                <button
                  type="button"
                  onClick={() => upd("paymentMethod", "cod")}
                  className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-colors ${
                    formData.paymentMethod === "cod"
                      ? "border-green-500 bg-green-50 dark:bg-green-500/10"
                      : "border-border hover:border-muted-foreground/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">💵</span>
                    <div>
                      <p className="font-medium">Cash on Delivery</p>
                      <p className="text-xs text-muted-foreground">Pay when your order arrives</p>
                    </div>
                  </div>
                </button>
              )}
              <button
                type="button"
                onClick={() => upd("paymentMethod", "binance")}
                className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-colors ${
                  formData.paymentMethod === "binance"
                    ? "border-[#F0B90B] bg-[#F0B90B]/10"
                    : "border-border hover:border-muted-foreground/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex w-9 h-9 items-center justify-center rounded-md bg-white ring-1 ring-[#F0B90B]/40">
                    <BinanceLogo className="w-6 h-6" />
                  </span>
                  <div className="flex-1">
                    <p className="font-medium">Pay with Binance Pay</p>
                    <p className="text-xs text-muted-foreground">
                      Crypto checkout · USDT auto-converted from {currencySymbol}
                      {total.toFixed(2)}
                    </p>
                  </div>
                  <Badge className="bg-[#F0B90B] text-black hover:bg-[#F0B90B]">Crypto</Badge>
                </div>
              </button>
              {config.paymentMethods.includes("card") && (
                <div className="w-full rounded-xl border-2 border-border px-4 py-3 opacity-50 cursor-not-allowed">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">💳</span>
                    <div className="flex-1">
                      <p className="font-medium">Credit / Debit Card</p>
                    </div>
                    <Badge variant="secondary">Coming Soon</Badge>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <Label htmlFor="checkout-note">
                  Order Note <span className="text-muted-foreground text-xs">(Optional)</span>
                </Label>
                <Textarea
                  id="checkout-note"
                  rows={3}
                  value={formData.customerNote}
                  onChange={(e) => upd("customerNote", e.target.value)}
                  placeholder="Special instructions for your order..."
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {errors.submit && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-sm text-red-600">
                {errors.submit}
              </div>
            )}
            <Button
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white"
              disabled={isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...
                </>
              ) : (
                "Place Order →"
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              🔒 Secure checkout · Your information is protected
            </p>
          </div>
        </div>

        {/* RIGHT — Order Summary */}
        <div className="order-1 lg:order-2">
          <Card className="lg:sticky lg:top-4">
            <CardHeader>
              <CardTitle className="text-base">Your Order</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {cartItems.map((it, idx) => (
                  <div key={`${it.product_id}-${it.variant_id || idx}`} className="flex gap-3">
                    {it.image_url ? (
                      <img
                        src={it.image_url}
                        alt={it.title}
                        className="w-10 h-10 rounded object-cover bg-secondary shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-secondary shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight truncate">{it.title}</p>
                      {it.variant_title && (
                        <p className="text-xs text-muted-foreground truncate">{it.variant_title}</p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                          ×{it.quantity}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm font-medium shrink-0">
                      {fmt(it.retail_price * it.quantity)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-t pt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping ({estimate.zoneLabel})</span>
                  <span>
                    {estimate.isFree ? (
                      <span className="text-green-600 font-medium">FREE</span>
                    ) : (
                      fmt(shipping_fee)
                    )}
                  </span>
                </div>
                {!estimate.isFree &&
                  estimate.freeShippingThreshold &&
                  subtotal < estimate.freeShippingThreshold && (
                    <p className="text-[11px] text-muted-foreground">
                      Add {fmt(estimate.freeShippingThreshold - subtotal)} more for free shipping
                    </p>
                  )}
              </div>
              <div className="border-t pt-3 flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{fmt(total)}</span>
              </div>
              <div className="rounded-lg bg-secondary/50 px-3 py-2 flex items-start gap-2 text-xs">
                <Truck className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-foreground">
                    Estimated delivery: {estimate.minDays}–{estimate.maxDays} business days
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    To{" "}
                    {formData.shippingCity ||
                      formData.shippingState ||
                      formData.shippingCountryName}
                    {formData.shippingPostal ? ` · ${formData.shippingPostal}` : ""}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <BinancePayModal
        open={binanceOpen}
        onClose={() => setBinanceOpen(false)}
        orderId={orderSuccess?.order_id ?? null}
        orderNumber={orderSuccess?.order_number ?? null}
        fiatAmount={total}
        fiatCurrency={config.currency || "USD"}
        onPaid={() => {
          setBinancePaid(true);
          setBinanceOpen(false);
        }}
      />
    </div>
  );
}
