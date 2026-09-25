import { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { ADDRESS_CONFIGS, getAddressConfig } from "@/config/addressConfig";
import { COUNTRIES as INTL_COUNTRIES } from "@/components/PhoneInputIntl";
import { resolveStorageImageUrl, STORAGE_PRODUCT_FALLBACK_URL } from "@/lib/storageImage";

export interface SavedAddress {
  id: string;
  label: string | null;
  full_name: string | null;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country_code: string | null;
  country_name: string | null;
  is_default: boolean;
}

export interface CheckoutFormData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  countryCode: string;
  shippingLine1: string;
  shippingLine2: string;
  shippingCity: string;
  shippingState: string;
  shippingPostal: string;
  shippingCountry: string;
  shippingCountryName: string;
  paymentMethod: string;
  customerNote: string;
}

export interface OrderSuccess {
  order_number: string;
  order_id: string;
  tracking_number?: string | null;
  channel: string;
}

const DEFAULT_FORM: CheckoutFormData = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  countryCode: "+971",
  shippingLine1: "",
  shippingLine2: "",
  shippingCity: "",
  shippingState: "",
  shippingPostal: "",
  shippingCountry: "AE",
  shippingCountryName: "United Arab Emirates",
  paymentMethod: "cod",
  customerNote: "",
};

export function useCheckout() {
  const { items, clearCart } = useCart();
  const { user } = useAuth();
  const [selectedCountry, setSelectedCountry] = useState<string>("AE");
  const [formData, setFormData] = useState<CheckoutFormData>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<OrderSuccess | null>(null);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const submitLockRef = useRef(false);

  const applyAddress = (a: SavedAddress) => {
    const countryCode = a.country_code || selectedCountry;
    const cfg = getAddressConfig(countryCode);
    setSelectedCountry(countryCode);
    setSelectedAddressId(a.id);
    // Best-effort split of stored phone into prefix + national digits
    let phonePrefix = cfg.phonePrefix;
    let phoneDigits = (a.phone || "").trim();
    if (phoneDigits.startsWith("+")) {
      const match = INTL_COUNTRIES.find((c) => phoneDigits.startsWith(c.dial));
      if (match) {
        phonePrefix = match.dial;
        phoneDigits = phoneDigits.slice(match.dial.length);
      }
    }
    phoneDigits = phoneDigits.replace(/\D/g, "");
    setFormData((prev) => ({
      ...prev,
      customerName: a.full_name || prev.customerName,
      customerPhone: phoneDigits || prev.customerPhone,
      countryCode: phonePrefix,
      shippingLine1: a.line1 || "",
      shippingLine2: a.line2 || "",
      shippingCity: a.city || "",
      shippingState: a.state || "",
      shippingPostal: a.postal_code || "",
      shippingCountry: countryCode,
      shippingCountryName: a.country_name || cfg.countryName,
      paymentMethod: countryCode === "BD" ? "cod" : prev.paymentMethod,
    }));
    setErrors({});
  };

  useEffect(() => {
    if (!user) {
      setAddresses([]);
      setSelectedAddressId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setAddressesLoading(true);
      const { data, error } = await supabase
        .from("user_addresses")
        .select(
          "id,label,full_name,phone,line1,line2,city,state,postal_code,country_code,country_name,is_default",
        )
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("updated_at", { ascending: false });
      setAddressesLoading(false);
      if (cancelled || error || !data) return;
      const list = data as SavedAddress[];
      setAddresses(list);
      const def = list.find((a) => a.is_default) || list[0];
      if (def) applyAddress(def);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const config = getAddressConfig(selectedCountry);
  const isBangladesh = selectedCountry === "BD";

  const cartItems = useMemo(
    () =>
      items.map((it) => {
        const image = it.product.image
          ? resolveStorageImageUrl(it.product.image, STORAGE_PRODUCT_FALLBACK_URL, "product-images")
          : null;
        return {
          product_id: it.product.id,
          variant_id: it.variantId || null,
          title: it.product.title,
          variant_title: it.variantLabel || null,
          quantity: it.quantity,
          retail_price: (it.product.price || 0) + (it.priceDelta || 0),
          cogs: (it.product as any).cogs || 0,
          external_id: (it.product as any).external_id || null,
          external_variant_id: (it.product as any).external_variant_id || null,
          image_url: image,
        };
      }),
    [items],
  );

  const handleCountryChange = (countryCode: string) => {
    const cfg = getAddressConfig(countryCode);
    setSelectedCountry(countryCode);
    setSelectedAddressId(null);
    setFormData((prev) => ({
      ...prev,
      shippingCountry: countryCode,
      shippingCountryName: cfg.countryName,
      countryCode: cfg.phonePrefix,
      paymentMethod: countryCode === "BD" ? "cod" : prev.paymentMethod,
      shippingState: "",
    }));
    setErrors({});
  };

  const selectAddress = (id: string) => {
    const a = addresses.find((x) => x.id === id);
    if (a) applyAddress(a);
  };

  const clearSelectedAddress = () => {
    setSelectedAddressId(null);
  };

  const handlePhonePrefixChange = (prefix: string) => {
    setFormData((prev) => ({ ...prev, countryCode: prefix }));
    const match = Object.entries(ADDRESS_CONFIGS).find(([, c]) => c.phonePrefix === prefix);
    if (match) handleCountryChange(match[0]);
    else {
      const intl = INTL_COUNTRIES.find((c) => c.dial === prefix);
      if (intl) handleCountryChange(intl.iso);
    }
  };

  const validateForm = (): boolean => {
    const e: Record<string, string> = {};
    if (!formData.customerName || formData.customerName.trim().length < 2) {
      e.customerName = "Full name is required (min 2 characters)";
    }
    const phoneDigits = (formData.customerPhone || "").replace(/[\s-]/g, "");
    if (!phoneDigits) {
      e.customerPhone = "Phone number is required";
    } else if (!/^\d{7,15}$/.test(phoneDigits)) {
      e.customerPhone = "Phone must be 7–15 digits";
    }
    if (!formData.shippingLine1?.trim())
      e.shippingLine1 = `${config.fields.line1.label} is required`;
    if (!formData.shippingCity?.trim())
      e.shippingCity = `${(config.fields.city as any).label} is required`;
    if ((config.fields.state as any).required && !formData.shippingState?.trim()) {
      e.shippingState = `${config.fields.state.label} is required`;
    }
    if (config.fields.postal.required && !formData.shippingPostal?.trim()) {
      e.shippingPostal = `${config.fields.postal.label} is required`;
    }
    if (formData.shippingPostal) {
      const p = formData.shippingPostal.trim();
      if (selectedCountry === "CA" && !/^[A-Za-z]\d[A-Za-z] \d[A-Za-z]\d$/.test(p)) {
        e.shippingPostal = "Canadian postal code must look like 'M5V 3A4'";
      }
      if (selectedCountry === "AU" && !/^\d{4}$/.test(p)) {
        e.shippingPostal = "Australian postcode must be exactly 4 digits";
      }
      if (selectedCountry === "SA" && !/^\d{5}$/.test(p)) {
        e.shippingPostal = "Saudi postal code must be exactly 5 digits";
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (submitLockRef.current) return;
    if (!validateForm()) return;
    if (cartItems.length === 0) {
      setErrors({ submit: "Your cart is empty" });
      return;
    }
    submitLockRef.current = true;
    setIsSubmitting(true);
    setErrors({});
    try {
      const rpcItems = cartItems.map((it) => ({
        product_id: it.product_id,
        variant_id: it.variant_id,
        quantity: it.quantity,
        image_url: it.image_url,
      }));

      const { data: result, error } = await supabase.rpc("create_order", {
        p_items: rpcItems as any,
        p_shipping: {
          name: formData.customerName,
          phone: `+${(formData.countryCode + formData.customerPhone).replace(/\D/g, "")}`,
          line1: formData.shippingLine1,
          line2: formData.shippingLine2 || null,
          city: formData.shippingCity,
          state: formData.shippingState || null,
          postal_code: formData.shippingPostal || null,
          country: formData.shippingCountry,
          country_name: formData.shippingCountryName,
          notes: formData.customerNote || null,
        },
        p_email: formData.customerEmail || undefined,
        p_coupon_code: undefined,
        p_payment_method: formData.paymentMethod,
      });

      if (error) throw new Error(error.message || "Failed to create order");

      const res = result as any;
      const orderId = res?.order_id as string | undefined;
      const orderNumber = res?.order_number as string | undefined;
      if (!orderId || !orderNumber)
        throw new Error("Order created but confirmation data was missing");

      setOrderSuccess({
        order_number: orderNumber,
        order_id: orderId,
        channel: "manual",
        tracking_number: null,
      });
      void supabase.functions
        .invoke("process-order", { body: { order_id: orderId } })
        .catch(() => {});
      void clearCart();
    } catch (err: unknown) {
      setErrors({
        submit: (err instanceof Error ? err.message : String(err)) || "Failed to place order",
      });
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  return {
    selectedCountry,
    formData,
    setFormData,
    errors,
    isSubmitting,
    orderSuccess,
    config,
    isBangladesh,
    cartItems,
    handleCountryChange,
    handlePhonePrefixChange,
    validateForm,
    handleSubmit,
    addresses,
    addressesLoading,
    selectedAddressId,
    selectAddress,
    clearSelectedAddress,
  };
}
