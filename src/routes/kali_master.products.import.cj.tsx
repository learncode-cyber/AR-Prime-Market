import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminPending, AdminErrorComponent, AdminNotFound } from "@/lib/admin-route-boundaries";
import { SingleImport } from "@/lib/products-import-shared";
import { AutonomousSourcingDashboard } from "@/lib/autonomous-sourcing-dashboard";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChevronDown } from "lucide-react";
import { CompetitorAdsSpyPanel } from "@/components/admin/competitor-spy/CompetitorAdsSpyPanel";

function CjImportPage() {
  const [manualOpen, setManualOpen] = useState(false);
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">CJ Sourcing Control Center</h1>
        <p className="text-sm text-muted-foreground">
          Fully autonomous AI pipeline. The crew approves — agents source, polish, and import.
        </p>
      </div>

      <Tabs defaultValue="importer">
        <TabsList>
          <TabsTrigger value="importer">Importer</TabsTrigger>
          <TabsTrigger value="spy">🎯 Competitor Ads Spy Agent Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="importer" className="space-y-4 mt-4">
          <AutonomousSourcingDashboard />
          <Collapsible open={manualOpen} onOpenChange={setManualOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between">
                <span>Manual SKU import (fallback)</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${manualOpen ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SingleImport provider="cj" hint="Paste CJ product ID or full product URL" />
            </CollapsibleContent>
          </Collapsible>
        </TabsContent>

        <TabsContent value="spy" className="mt-4">
          <CompetitorAdsSpyPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export const Route = createFileRoute("/kali_master/products/import/cj")({
  pendingComponent: () => <AdminPending />,
  errorComponent: AdminErrorComponent,
  notFoundComponent: AdminNotFound,
  component: CjImportPage,
});
