import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Truck,
  ChevronDown,
} from "lucide-react";
import { useOrderDetail } from "@/hooks/useOrderDetail";
import { recordSensitiveAccess } from "@/lib/audit-log";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export const Route = createFileRoute("/kali_master/orders/$orderId")({
  component: OrderDetailPage,
});

const COUNTRY_FLAGS: Record<string, string> = {
  AE: "🇦🇪",
  SA: "🇸🇦",
  AU: "🇦🇺",
  CA: "🇨🇦",
  BD: "🇧🇩",
  US: "🇺🇸",
  GB: "🇬🇧",
};
const flagFor = (cc?: string | null) => (cc && COUNTRY_FLAGS[cc]) || "🌍";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  confirmed: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  processing: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  shipped: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  delivered: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  cancelled: "bg-red-500/15 text-red-600 dark:text-red-400",
};

const STATUS_ORDER = ["pending", "confirmed", "processing", "shipped", "delivered"];

function formatMoney(amount: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount || 0);
  } catch {
    return `${(amount || 0).toFixed(2)} ${currency}`;
  }
}

function copy(text: string) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(
    () => toast.success("Copied"),
    () => toast.error("Failed to copy"),
  );
}

function OrderDetailPage() {
  const { orderId } = Route.useParams();
  const {
    order,
    orderItems,
    isLoading,
    isFulfilling,
    fulfillResult,
    setFulfillResult,
    pushToSteadFast,
    pushToCJ,
    markManuallyFulfilled,
    updateAdminNote,
    cancelOrder,
  } = useOrderDetail(orderId);

  const [adminNote, setAdminNote] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [trackingInput, setTrackingInput] = useState("");
  const [carrierInput, setCarrierInput] = useState("");
  const [cancelConfirm, setCancelConfirm] = useState(false);

  useEffect(() => {
    if (order?.admin_note != null) setAdminNote(order.admin_note);
  }, [order?.admin_note]);

  // Audit log: record when an admin views per-item cost data on an order.
  useEffect(() => {
    if (!orderId || !orderItems || orderItems.length === 0) return;
    const hasCogs = orderItems.some((it: { cogs?: number | null }) => it.cogs != null);
    if (!hasCogs) return;
    recordSensitiveAccess({
      table_name: "order_items",
      fields: ["cogs", "supplier_product_id"],
      record_ids: [orderId],
      context: `admin:order detail ${orderId}`,
      row_count: orderItems.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, orderItems?.length]);

  // Auto-hide fulfillment result
  useEffect(() => {
    if (!fulfillResult) return;
    const t = setTimeout(() => setFulfillResult(null), 8000);
    return () => clearTimeout(t);
  }, [fulfillResult, setFulfillResult]);

  if (isLoading || !order) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading order…
      </div>
    );
  }

  const currency = order.currency || "USD";
  const subtotal =
    order.subtotal != null
      ? Number(order.subtotal)
      : orderItems.reduce((s, i) => s + Number(i.unit_price || 0) * (i.quantity || 0), 0);
  const shipping = Number(order.shipping_fee || 0);
  const total = Number(order.total_amount || 0);
  const currentStatusIdx = STATUS_ORDER.indexOf(order.status || "pending");
  const isBD = order.shipping_country === "BD";
  const statusCls = STATUS_STYLES[order.status || "pending"] || STATUS_STYLES.pending;

  const handleSaveNote = async () => {
    try {
      await updateAdminNote(adminNote);
      toast.success("Note saved");
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || "Failed to save note");
    }
  };

  const handleManualSubmit = async () => {
    if (!trackingInput.trim() || !carrierInput.trim()) {
      toast.error("Tracking number and carrier are required");
      return;
    }
    await markManuallyFulfilled(trackingInput.trim(), carrierInput.trim());
    setManualOpen(false);
    setTrackingInput("");
    setCarrierInput("");
  };

  const handleCancel = async () => {
    try {
      await cancelOrder();
      toast.success("Order cancelled");
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || "Failed to cancel");
    } finally {
      setCancelConfirm(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/kali_master/orders">
            <ArrowLeft className="h-4 w-4 mr-1" /> Orders
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* LEFT */}
        <div className="space-y-6">
          {/* Header */}
          <Card className="border-border/50">
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">
                  {order.order_number || `Order ${order.id.slice(0, 8)}`}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(order.created_at).toLocaleString()}
                </p>
              </div>
              <Badge variant="secondary" className={`capitalize ${statusCls}`}>
                {order.status || "pending"}
              </Badge>
            </CardContent>
          </Card>

          {/* Customer */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Customer</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <Field label="Full Name" value={order.customer_name} onCopy={copy} />
              <Field
                label="Phone"
                value={order.customer_phone}
                prefix={flagFor(order.customer_country_code)}
                onCopy={copy}
              />
              {order.customer_email && (
                <Field label="Email" value={order.customer_email} onCopy={copy} />
              )}
              {order.customer_country_code && (
                <Field label="Country Code" value={order.customer_country_code} />
              )}
            </CardContent>
          </Card>

          {/* Shipping Address */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Shipping Address</CardTitle>
            </CardHeader>
            <CardContent className="flex items-start gap-4">
              <span className="text-[2rem] leading-none">{flagFor(order.shipping_country)}</span>
              <div className="text-sm space-y-0.5">
                {order.shipping_line1 && <div>{order.shipping_line1}</div>}
                {order.shipping_line2 && <div>{order.shipping_line2}</div>}
                <div>{[order.shipping_city, order.shipping_state].filter(Boolean).join(", ")}</div>
                <div className="text-muted-foreground">
                  {order.shipping_country_name || order.shipping_country}
                  {order.shipping_postal_code ? ` — ${order.shipping_postal_code}` : ""}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Items Ordered</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="text-left py-2 px-4">Image</th>
                      <th className="text-left py-2 px-4">Product</th>
                      <th className="text-left py-2 px-4">Variant</th>
                      <th className="text-right py-2 px-4">Qty</th>
                      <th className="text-right py-2 px-4">Unit</th>
                      <th className="text-right py-2 px-4">Total</th>
                      <th className="text-right py-2 px-4">COGS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map((it: any) => {
                      const lineTotal = Number(it.unit_price || 0) * (it.quantity || 0);
                      return (
                        <tr key={it.id} className="border-b border-border/40">
                          <td className="py-2 px-4">
                            {it.image_url ? (
                              <img
                                src={it.image_url}
                                alt=""
                                className="h-12 w-12 rounded object-cover"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded bg-muted" />
                            )}
                          </td>
                          <td className="py-2 px-4">
                            <p className="font-medium">{it.title || it.products?.title}</p>
                          </td>
                          <td className="py-2 px-4 text-muted-foreground">
                            {it.variant_label || it.variant_title || "—"}
                          </td>
                          <td className="py-2 px-4 text-right">{it.quantity}</td>
                          <td className="py-2 px-4 text-right">
                            {formatMoney(Number(it.unit_price || 0), currency)}
                          </td>
                          <td className="py-2 px-4 text-right font-medium">
                            {formatMoney(lineTotal, currency)}
                          </td>
                          <td className="py-2 px-4 text-right text-muted-foreground">
                            {it.cogs != null ? formatMoney(Number(it.cogs), currency) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} className="text-right py-2 px-4 text-muted-foreground">
                        Subtotal
                      </td>
                      <td className="text-right py-2 px-4" colSpan={2}>
                        {formatMoney(subtotal, currency)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="text-right py-2 px-4 text-muted-foreground">
                        Shipping
                      </td>
                      <td className="text-right py-2 px-4" colSpan={2}>
                        {formatMoney(shipping, currency)}
                      </td>
                    </tr>
                    <tr className="border-t border-border">
                      <td colSpan={5} className="text-right py-3 px-4 font-semibold">
                        Total
                      </td>
                      <td className="text-right py-3 px-4 text-base font-bold" colSpan={2}>
                        {formatMoney(total, currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Customer Note</Label>
                <p className="text-sm mt-1 whitespace-pre-wrap">
                  {order.customer_note || (
                    <span className="text-muted-foreground italic">No customer note</span>
                  )}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Admin Note</Label>
                <Textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                  className="mt-1"
                  placeholder="Internal note about this order…"
                />
                <Button size="sm" className="mt-2" onClick={handleSaveNote}>
                  Save Note
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          {/* Fulfillment */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Fulfillment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <ol className="space-y-3">
                {STATUS_ORDER.map((s, idx) => {
                  const done = idx <= currentStatusIdx;
                  const isCurrent = idx === currentStatusIdx;
                  return (
                    <li key={s} className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {done ? "✓" : idx + 1}
                      </div>
                      <div>
                        <p className={`text-sm capitalize ${isCurrent ? "font-semibold" : ""}`}>
                          {s === "pending" ? "Order Placed" : s}
                        </p>
                        {idx === 0 && order.created_at && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.created_at).toLocaleString()}
                          </p>
                        )}
                        {isCurrent && idx > 0 && order.updated_at && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.updated_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>

              {order.tracking_number && (
                <div className="border-t border-border pt-4 space-y-2">
                  <Label className="text-xs text-muted-foreground">Tracking Number</Label>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
                      {order.tracking_number}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => copy(order.tracking_number)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {order.tracking_url && (
                    <a
                      href={order.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-sm text-primary hover:underline"
                    >
                      Track Package <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  )}
                  {order.courier_consignment_id && (
                    <p className="text-xs text-muted-foreground">
                      Consignment: {order.courier_consignment_id}
                    </p>
                  )}
                </div>
              )}

              {order.fulfillment_channel && (
                <Badge variant="secondary" className="text-sm">
                  <Truck className="h-3.5 w-3.5 mr-1.5" />
                  {order.fulfillment_channel}
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Fulfillment Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isBD ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🇧🇩</span>
                    <div>
                      <p className="font-semibold text-sm">Bangladesh COD Order</p>
                      <p className="text-xs text-muted-foreground">Route via SteadFast Courier</p>
                    </div>
                  </div>
                  {order.courier_consignment_id ? (
                    <div className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                      ✓ Submitted · {order.courier_consignment_id}
                    </div>
                  ) : (
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={isFulfilling}
                      onClick={pushToSteadFast}
                    >
                      {isFulfilling ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…
                        </>
                      ) : (
                        "Submit to SteadFast →"
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full border-purple-500/40 text-purple-600 dark:text-purple-300 hover:bg-purple-500/10"
                    disabled={isFulfilling || !!order.supplier_order_id}
                    onClick={pushToCJ}
                  >
                    {isFulfilling ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Pushing…
                      </>
                    ) : order.supplier_order_id ? (
                      `✓ Pushed (${order.supplier_order_id})`
                    ) : (
                      "Push to CJ Dropshipping"
                    )}
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => setManualOpen(true)}>
                    Mark as Manually Fulfilled
                  </Button>
                </div>
              )}

              {fulfillResult && (
                <Alert
                  variant={fulfillResult.success ? "default" : "destructive"}
                  className={fulfillResult.success ? "border-emerald-500/40 bg-emerald-500/5" : ""}
                >
                  {fulfillResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <AlertTitle>{fulfillResult.success ? "Success" : "Failed"}</AlertTitle>
                  <AlertDescription>
                    {fulfillResult.message}
                    {fulfillResult.tracking && (
                      <div className="mt-1 font-mono text-xs">
                        Tracking: {fulfillResult.tracking}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Collapsible>
            <Card className="border-red-500/30">
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer flex flex-row items-center justify-between">
                  <CardTitle className="text-sm text-red-600 dark:text-red-400">
                    Danger Zone
                  </CardTitle>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <Button
                    variant="outline"
                    className="w-full border-red-500/40 text-red-600 hover:bg-red-500/10"
                    onClick={() => setCancelConfirm(true)}
                    disabled={order.status === "cancelled"}
                  >
                    Cancel Order
                  </Button>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </div>

      {/* Manual fulfill dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Manually Fulfilled</DialogTitle>
            <DialogDescription>
              Enter tracking details to mark this order as shipped.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="tracking">Tracking Number</Label>
              <Input
                id="tracking"
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value)}
                placeholder="e.g., 1Z999AA1234567890"
              />
            </div>
            <div>
              <Label htmlFor="carrier">Carrier Name</Label>
              <Input
                id="carrier"
                value={carrierInput}
                onChange={(e) => setCarrierInput(e.target.value)}
                placeholder="e.g., DHL, FedEx, Aramex"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleManualSubmit}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirm */}
      <AlertDialog open={cancelConfirm} onOpenChange={setCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the order as cancelled and cannot be undone here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({
  label,
  value,
  prefix,
  onCopy,
}: {
  label: string;
  value?: string | null;
  prefix?: string;
  onCopy?: (text: string) => void;
}) {
  if (!value) return null;
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1.5 mt-1">
        {prefix && <span>{prefix}</span>}
        <span className="text-sm font-medium truncate">{value}</span>
        {onCopy && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onCopy(value)}>
            <Copy className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
