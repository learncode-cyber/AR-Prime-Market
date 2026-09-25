import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/kali_master/shipping-rates/carriers")({
  component: Carriers,
});

const CARRIERS = [
  { key: "pathao", name: "Pathao Courier", coverage: "Bangladesh wide", status: "Available" },
  { key: "redx", name: "RedX", coverage: "Bangladesh wide", status: "Available" },
  { key: "steadfast", name: "Steadfast Courier", coverage: "Bangladesh wide", status: "Available" },
  { key: "dhl", name: "DHL Express", coverage: "International", status: "Available" },
  { key: "fedex", name: "FedEx", coverage: "International", status: "Available" },
  { key: "aramex", name: "Aramex", coverage: "Middle East / Asia", status: "Available" },
];

function Carriers() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Shipping Carriers</h1>
        <p className="text-sm text-muted-foreground mt-1">Supported delivery partners</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARRIERS.map((c) => (
          <Card key={c.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>{c.name}</span>
                <Badge variant="secondary">{c.status}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{c.coverage}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
