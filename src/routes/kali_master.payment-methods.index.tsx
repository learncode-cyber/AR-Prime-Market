import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/kali_master/payment-methods/")({
  component: AdminPaymentMethods,
});

type Form = {
  id?: string;
  method_key: string;
  display_name: string;
  display_name_bn: string;
  icon_name: string;
  instructions: string;
  instructions_bn: string;
  wallet_address: string;
  deposit_link: string;
  sort_order: number;
  is_active: boolean;
};

const empty: Form = {
  method_key: "",
  display_name: "",
  display_name_bn: "",
  icon_name: "",
  instructions: "",
  instructions_bn: "",
  wallet_address: "",
  deposit_link: "",
  sort_order: 0,
  is_active: true,
};

function AdminPaymentMethods() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);

  const { data: rows, refetch } = useQuery({
    queryKey: ["admin-payment-methods"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("payment_methods")
        .select("*")
        .order("sort_order");
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
      method_key: r.method_key,
      display_name: r.display_name,
      display_name_bn: r.display_name_bn || "",
      icon_name: r.icon_name || "",
      instructions: r.instructions || "",
      instructions_bn: r.instructions_bn || "",
      wallet_address: r.wallet_address || "",
      deposit_link: r.deposit_link || "",
      sort_order: r.sort_order ?? 0,
      is_active: r.is_active,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.method_key || !form.display_name) {
      toast.error("Key and name required");
      return;
    }
    const payload = {
      method_key: form.method_key.toLowerCase().trim(),
      display_name: form.display_name,
      display_name_bn: form.display_name_bn || null,
      icon_name: form.icon_name || null,
      instructions: form.instructions || null,
      instructions_bn: form.instructions_bn || null,
      wallet_address: form.wallet_address || null,
      deposit_link: form.deposit_link || null,
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };
    const { error } = form.id
      ? await (supabase as any).from("payment_methods").update(payload).eq("id", form.id)
      : await (supabase as any).from("payment_methods").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved");
    setOpen(false);
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this payment method?")) return;
    const { error } = await (supabase as any).from("payment_methods").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      refetch();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payment Methods</h1>
          <p className="text-sm text-muted-foreground mt-1">{rows?.length || 0} methods</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> Add Method
        </Button>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Key</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Order</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows?.map((r: any) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/30">
                    <td className="py-3 px-4 font-mono">{r.method_key}</td>
                    <td className="py-3 px-4">
                      {r.display_name}
                      {r.display_name_bn && (
                        <span className="text-muted-foreground text-xs ml-2">
                          ({r.display_name_bn})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{r.sort_order}</td>
                    <td className="py-3 px-4">
                      <Badge variant={r.is_active ? "default" : "secondary"}>
                        {r.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Payment Method" : "New Payment Method"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Key</Label>
                <Input
                  value={form.method_key}
                  onChange={(e) => setForm({ ...form, method_key: e.target.value })}
                  placeholder="bkash"
                />
              </div>
              <div>
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: +e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Display Name (EN)</Label>
                <Input
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Display Name (BN)</Label>
                <Input
                  value={form.display_name_bn}
                  onChange={(e) => setForm({ ...form, display_name_bn: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Icon Name (lucide)</Label>
              <Input
                value={form.icon_name}
                onChange={(e) => setForm({ ...form, icon_name: e.target.value })}
                placeholder="smartphone"
              />
            </div>
            <div>
              <Label>Instructions (EN)</Label>
              <Textarea
                rows={2}
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              />
            </div>
            <div>
              <Label>Instructions (BN)</Label>
              <Textarea
                rows={2}
                value={form.instructions_bn}
                onChange={(e) => setForm({ ...form, instructions_bn: e.target.value })}
              />
            </div>
            <div>
              <Label>Wallet Address / Number</Label>
              <Input
                value={form.wallet_address}
                onChange={(e) => setForm({ ...form, wallet_address: e.target.value })}
              />
            </div>
            <div>
              <Label>Deposit Link</Label>
              <Input
                value={form.deposit_link}
                onChange={(e) => setForm({ ...form, deposit_link: e.target.value })}
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
