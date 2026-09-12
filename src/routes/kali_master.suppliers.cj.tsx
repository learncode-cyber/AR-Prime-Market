import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/kali_master/suppliers/cj")({
  component: CjSupplier,
});

const LINKS = [
  {
    label: "API Credentials",
    to: "/kali_master/cj-settings/api" as const,
    desc: "Manage CJ access tokens",
  },
  {
    label: "Imported Products",
    to: "/kali_master/cj-settings/imported" as const,
    desc: "View CJ products in catalog",
  },
  { label: "Search CJ", to: "/kali_master/cj-settings/search" as const, desc: "Browse and import" },
  { label: "Webhook", to: "/kali_master/cj-settings/webhook" as const, desc: "Order sync webhook" },
  { label: "Events", to: "/kali_master/cj-settings/events" as const, desc: "Activity log" },
];

function CjSupplier() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">CJ Dropshipping</h1>
        <p className="text-sm text-muted-foreground mt-1">CJ supplier configuration shortcuts</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {LINKS.map((l) => (
          <Card key={l.to}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{l.label}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{l.desc}</p>
              <Button asChild size="sm" variant="outline">
                <Link to={l.to}>
                  Open <ArrowRight className="w-3 h-3 ml-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
