import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/order-confirmation/$orderId")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: LegacyRedirect,
});

function LegacyRedirect() {
  const { orderId } = Route.useParams();
  const { token } = Route.useSearch();
  const [ref, setRef] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("order_number")
        .eq("id", orderId)
        .maybeSingle();
      if (cancelled) return;
      setRef((data?.order_number as string | undefined) || orderId);
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (!ref) return null;
  return <Navigate to="/thank-you" search={{ order: ref, token: token ?? undefined }} replace />;
}
