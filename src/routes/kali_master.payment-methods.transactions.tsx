import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/kali_master/payment-methods/transactions")({
  component: Transactions,
});

function Transactions() {
  const { data } = useQuery({
    queryKey: ["payment-transactions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select(
          "id, order_number, total_amount, currency, payment_method, payment_status, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Recent Transactions</h1>
        <p className="text-sm text-muted-foreground mt-1">Last 100 payments</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Order</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Method</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Amount</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {data?.map((t: any) => (
                  <tr key={t.id} className="border-b border-border/50">
                    <td className="py-3 px-4 font-mono text-xs">
                      {t.order_number || t.id.slice(0, 8)}
                    </td>
                    <td className="py-3 px-4 capitalize">{t.payment_method || "—"}</td>
                    <td className="py-3 px-4">
                      {t.currency || "৳"}
                      {Number(t.total_amount || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={t.payment_status === "paid" ? "default" : "secondary"}>
                        {t.payment_status || "pending"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {!data?.length && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No transactions yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
