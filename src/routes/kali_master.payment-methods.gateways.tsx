import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

export const Route = createFileRoute("/kali_master/payment-methods/gateways")({
  component: Gateways,
});

const GATEWAYS = [
  {
    key: "stripe",
    name: "Stripe",
    desc: "Cards, Apple/Google Pay (worldwide)",
    status: "Configured",
    href: "/kali_master/integrations/payments" as const,
  },
  {
    key: "binance",
    name: "Binance Pay",
    desc: "Crypto checkout",
    status: "Configured",
    href: "/kali_master/integrations/payments" as const,
  },
  {
    key: "bkash",
    name: "bKash",
    desc: "Mobile wallet",
    status: "Configured",
    href: "/kali_master/integrations/payments" as const,
  },
  {
    key: "paddle",
    name: "Paddle",
    desc: "Merchant of record",
    status: "Available",
    href: "/kali_master/integrations/payments" as const,
  },
];

function Gateways() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payment Gateways</h1>
        <p className="text-sm text-muted-foreground mt-1">
          External processors connected to your store
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {GATEWAYS.map((g) => (
          <Card key={g.key}>
            <CardHeader className="pb-2 flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-base">{g.name}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">{g.desc}</p>
              </div>
              <Badge variant={g.status === "Configured" ? "default" : "secondary"}>
                {g.status}
              </Badge>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link to={g.href}>
                  Configure <ExternalLink className="w-3 h-3 ml-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
