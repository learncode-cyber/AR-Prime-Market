import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit, Trash2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/kali_master/suppliers/")({
  component: AdminSuppliers,
});

type Form = {
  id?: string;
  name: string;
  provider: string;
  api_endpoint: string;
  api_key_ref: string;
  is_active: boolean;
};

const empty: Form = {
  name: "",
  provider: "custom",
  api_endpoint: "",
  api_key_ref: "",
  is_active: true,
};

function AdminSuppliers() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);
  const [syncing, setSyncing] = useState<string | null>(null);

  const { data: rows, refetch } = useQuery({
    queryKey: ["admin-suppliers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("suppliers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        toast.error(error.message);
        return [];
      }
      return data || [];
    },
  });

  const openCreate = () => {
    setForm(empty);
    setOpen(true);
  };
  const openEdit = (r: any) => {
    setForm({
      id: r.id,
      name: r.name,
      provider: r.provider,
      api_endpoint: r.api_endpoint || "",
      api_key_ref: r.api_key_ref || "",
      is_active: r.is_active,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) {
      toast.error("Name required");
      return;
    }
    const payload = {
      name: form.name.trim(),
      provider: form.provider,
      api_endpoint: form.api_endpoint || null,
      api_key_ref: form.api_key_ref || null,
      is_active: form.is_active,
    };
    const { error } = form.id
      ? await (supabase as any).from("suppliers").update(payload).eq("id", form.id)
      : await (supabase as any).from("suppliers").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved");
    setOpen(false);
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this supplier?")) return;
    const { error } = await (supabase as any).from("suppliers").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      refetch();
    }
  };

  const handleSync = async (id: string) => {
    setSyncing(id);
    try {
      const { error } = await supabase.functions.invoke("supplier-sync", {
        body: { supplier_id: id },
      });
      if (error) throw new Error(error.message);
      toast.success("Sync triggered");
      refetch();
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || "Sync failed");
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Suppliers</h1>
          <p className="text-sm text-muted-foreground mt-1">{rows?.length || 0} suppliers</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> Add Supplier
        </Button>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Provider
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Last Sync
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows?.map((r: any) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/30">
                    <td className="py-3 px-4 font-medium">{r.name}</td>
                    <td className="py-3 px-4 text-muted-foreground capitalize">{r.provider}</td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">
                      {r.last_sync_at ? new Date(r.last_sync_at).toLocaleString() : "Never"}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={r.is_active ? "default" : "secondary"}>
                        {r.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={syncing === r.id}
                        onClick={() => handleSync(r.id)}
                        title="Sync now"
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${syncing === r.id ? "animate-spin" : ""}`}
                        />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Supplier" : "New Supplier"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Provider</Label>
              <Select
                value={form.provider}
                onValueChange={(v) => setForm({ ...form, provider: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cj">CJ Dropshipping</SelectItem>
                  <SelectItem value="aliexpress">AliExpress</SelectItem>
                  <SelectItem value="spocket">Spocket</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>API Endpoint</Label>
              <Input
                value={form.api_endpoint}
                onChange={(e) => setForm({ ...form, api_endpoint: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>API Key Ref (integration_secrets.provider)</Label>
              <Input
                value={form.api_key_ref}
                onChange={(e) => setForm({ ...form, api_key_ref: e.target.value })}
                placeholder="cj_api"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
