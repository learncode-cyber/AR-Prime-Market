import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/kali_master/suppliers/aliexpress")({
  component: AliexpressSupplier,
});

function AliexpressSupplier() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AliExpress</h1>
        <p className="text-sm text-muted-foreground mt-1">Import products from AliExpress</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Import via URL</p>
              <p className="text-sm text-muted-foreground">Paste an AliExpress product URL</p>
            </div>
            <Button asChild size="sm">
              <Link to="/kali_master/products/import/aliexpress">Open Importer</Link>
            </Button>
          </div>
          <div className="flex items-center justify-between border-t border-border/40 pt-3">
            <div>
              <p className="font-medium">Manage suppliers</p>
              <p className="text-sm text-muted-foreground">Add or edit AliExpress accounts</p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/kali_master/suppliers">All Suppliers</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
