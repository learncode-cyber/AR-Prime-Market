import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AppliedCoupon {
  code: string;
  discount_type: string;
  discount_value: number;
}

export function useCoupon(subtotal: number) {
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [loading, setLoading] = useState(false);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", couponCode.trim().toUpperCase())
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error("Invalid coupon code");
        return;
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        toast.error("This coupon has expired");
        return;
      }

      if (data.min_order_amount && subtotal < Number(data.min_order_amount)) {
        toast.error(`Minimum order amount: ৳${data.min_order_amount}`);
        return;
      }

      setAppliedCoupon({
        code: data.code!,
        discount_type: data.discount_type || "percentage",
        discount_value: Number(data.discount_value || 0),
      });
      toast.success(`Coupon "${data.code}" applied!`);
    } catch (err: unknown) {
      toast.error("Failed to apply coupon");
    } finally {
      setLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    toast.info("Coupon removed");
  };

  const discountAmount = appliedCoupon
    ? appliedCoupon.discount_type === "percentage"
      ? (subtotal * appliedCoupon.discount_value) / 100
      : appliedCoupon.discount_value
    : 0;

  const finalTotal = Math.max(0, subtotal - discountAmount);

  return {
    couponCode,
    setCouponCode,
    appliedCoupon,
    loading,
    applyCoupon,
    removeCoupon,
    discountAmount,
    finalTotal,
  };
}
