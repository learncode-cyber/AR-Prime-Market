import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface FulfillResult {
  success: boolean;
  message: string;
  tracking?: string;
}

export function useOrderDetail(orderId: string | undefined) {
  const [order, setOrder] = useState<any | null>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFulfilling, setIsFulfilling] = useState(false);
  const [fulfillResult, setFulfillResult] = useState<FulfillResult | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    setIsLoading(true);
    try {
      const [{ data: o, error: oErr }, { data: items, error: iErr }] = await Promise.all([
        supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
        supabase
          .from("order_items")
          .select("*, products(title, source, external_id)")
          .eq("order_id", orderId),
      ]);
      if (oErr) throw oErr;
      if (iErr) throw iErr;
      setOrder(o);
      setOrderItems(items || []);
    } catch (e) {
      console.error("fetchOrder error", e);
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const invokeProcess = async (body: Record<string, any>) => {
    setIsFulfilling(true);
    setFulfillResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("process-order", { body });
      // Supabase treats non-2xx as `error`, but the JSON body still carries our message
      const payloadError = (data as any)?.error;
      if (error && !data) throw error;
      const success = (data as any)?.success !== false && !payloadError;
      const tracking =
        (data as any)?.tracking_number || (data as any)?.tracking || (data as any)?.consignment_id;
      const msg =
        payloadError ||
        (data as any)?.message ||
        (success ? "Order pushed successfully" : "Push failed");
      setFulfillResult({ success, message: msg, tracking });
      if (success) {
        toast.success(msg);
      } else {
        toast.error("Fulfillment failed", { description: msg });
      }
    } catch (e: unknown) {
      const msg = (e instanceof Error ? e.message : String(e)) || "Failed to push order";
      setFulfillResult({ success: false, message: msg });
      toast.error("Fulfillment failed", { description: msg });
    } finally {
      setIsFulfilling(false);
      await fetchOrder();
    }
  };

  const pushToSteadFast = useCallback(
    () => invokeProcess({ order_id: orderId }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orderId],
  );

  const pushToCJ = useCallback(
    () => invokeProcess({ order_id: orderId, force_channel: "cj_dropshipping" }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orderId],
  );

  const markManuallyFulfilled = useCallback(
    async (trackingNumber: string, carrier: string) => {
      if (!orderId) return;
      const { error } = await supabase
        .from("orders")
        .update({
          status: "shipped" as any,
          fulfillment_status: "fulfilled",
          fulfillment_channel: "manual",
          tracking_number: trackingNumber,
          admin_note: `Manually fulfilled via ${carrier}`,
        })
        .eq("id", orderId);
      if (error) {
        setFulfillResult({ success: false, message: error.message });
        return;
      }
      setFulfillResult({
        success: true,
        message: `Marked as shipped via ${carrier}`,
        tracking: trackingNumber,
      });
      await fetchOrder();
    },
    [orderId, fetchOrder],
  );

  const updateAdminNote = useCallback(
    async (note: string) => {
      if (!orderId) return;
      const { error } = await supabase
        .from("orders")
        .update({ admin_note: note })
        .eq("id", orderId);
      if (error) throw error;
      await fetchOrder();
    },
    [orderId, fetchOrder],
  );

  const cancelOrder = useCallback(async () => {
    if (!orderId) return;
    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled" as any })
      .eq("id", orderId);
    if (error) throw error;
    await fetchOrder();
  }, [orderId, fetchOrder]);

  return {
    order,
    orderItems,
    isLoading,
    isFulfilling,
    fulfillResult,
    setFulfillResult,
    fetchOrder,
    pushToSteadFast,
    pushToCJ,
    markManuallyFulfilled,
    updateAdminNote,
    cancelOrder,
  };
}
