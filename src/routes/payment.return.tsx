import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

type Search = {
  provider?: string;
  paymentID?: string;
  status?: string;
  order_id?: string;
  prepayId?: string;
  token?: string;
};

export const Route = createFileRoute("/payment/return")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    provider: typeof s.provider === "string" ? s.provider : undefined,
    paymentID: typeof s.paymentID === "string" ? s.paymentID : undefined,
    status: typeof s.status === "string" ? s.status : undefined,
    order_id: typeof s.order_id === "string" ? s.order_id : undefined,
    prepayId: typeof s.prepayId === "string" ? s.prepayId : undefined,
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  component: PaymentReturnPage,
});

function PaymentReturnPage() {
  const search = useSearch({ from: "/payment/return" }) as Search;
  const navigate = useNavigate();
  const [state, setState] = useState<"verifying" | "success" | "failed">("verifying");
  const [message, setMessage] = useState("Verifying your payment...");

  useEffect(() => {
    const verify = async () => {
      try {
        if (search.provider === "bkash" && search.paymentID) {
          const { data, error } = await supabase.functions.invoke("bkash-pay", {
            body: { action: "execute", paymentID: search.paymentID, order_id: search.order_id },
          });
          if (error || !data?.success) {
            setState("failed");
            setMessage(data?.message || "bKash payment could not be verified.");
            return;
          }
          setState("success");
          setMessage("bKash payment confirmed!");
          setTimeout(
            () =>
              navigate({
                to: "/order-confirmation/$orderId",
                params: { orderId: data.order_id || search.order_id! },
                search: search.token ? { token: search.token } : {},
              } as any),
            1500,
          );
          return;
        }

        if (search.provider === "binance" && search.prepayId) {
          const { data, error } = await supabase.functions.invoke("binance-pay-gateway", {
            body: { action: "verify", prepayId: search.prepayId, order_id: search.order_id },
          });
          if (error || !data?.success) {
            setState("failed");
            setMessage(data?.message || "Binance Pay could not be verified.");
            return;
          }
          setState("success");
          setMessage("Binance Pay confirmed!");
          setTimeout(
            () =>
              navigate({
                to: "/order-confirmation/$orderId",
                params: { orderId: data.order_id || search.order_id! },
                search: search.token ? { token: search.token } : {},
              } as any),
            1500,
          );
          return;
        }

        setState("failed");
        setMessage("Missing payment parameters.");
      } catch (err: unknown) {
        setState("failed");
        setMessage((err instanceof Error ? err.message : String(err)) || "Verification failed.");
      }
    };
    verify();
  }, []);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center">
        {state === "verifying" && (
          <>
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <h2 className="font-display font-bold text-lg text-foreground">Verifying payment</h2>
            <p className="text-sm text-muted-foreground mt-2">{message}</p>
          </>
        )}
        {state === "success" && (
          <>
            <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
            <h2 className="font-display font-bold text-lg text-foreground">Payment Successful</h2>
            <p className="text-sm text-muted-foreground mt-2">{message}</p>
            <p className="text-xs text-muted-foreground mt-3">Redirecting to your order...</p>
          </>
        )}
        {state === "failed" && (
          <>
            <XCircle className="w-14 h-14 text-destructive mx-auto mb-4" />
            <h2 className="font-display font-bold text-lg text-foreground">Payment Failed</h2>
            <p className="text-sm text-muted-foreground mt-2">{message}</p>
            <div className="flex gap-2 justify-center mt-5">
              {search.order_id && (
                <Link
                  to="/order-confirmation/$orderId"
                  params={{ orderId: search.order_id }}
                  search={search.token ? { token: search.token } : ({} as any)}
                  className="px-4 py-2 rounded-xl border border-border text-sm hover:bg-secondary"
                >
                  View Order
                </Link>
              )}
              <Link
                to="/"
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
              >
                Home
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
