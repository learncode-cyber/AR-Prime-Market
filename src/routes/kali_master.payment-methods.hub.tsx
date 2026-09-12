import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Plug, Receipt } from "lucide-react";
import { SectionHub } from "@/components/admin/SectionHub";

export const Route = createFileRoute("/kali_master/payment-methods/hub")({
  component: PaymentsHub,
});

function PaymentsHub() {
  return (
    <SectionHub
      title="All Payments"
      subtitle="Methods, gateways ও transactions overview"
      items={[
        {
          label: "Methods",
          href: "/kali_master/payment-methods",
          description: "Customer-facing payment options",
          icon: CreditCard,
        },
        {
          label: "Gateways",
          href: "/kali_master/payment-methods/gateways",
          description: "Stripe, bKash, Binance Pay config",
          icon: Plug,
        },
        {
          label: "Transactions",
          href: "/kali_master/payment-methods/transactions",
          description: "Order payment logs ও status",
          icon: Receipt,
        },
      ]}
    />
  );
}
