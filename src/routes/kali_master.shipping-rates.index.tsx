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
import { Plus, Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/kali_master/shipping-rates/")({
  component: AdminShippingRates,
});

type Form = {
  id?: string;
  zone_name: string;
  shipping_type: string;
  base_cost: number;
  per_kg_cost: number;
  min_days: number;
  max_days: number;
  is_active: boolean;
};

const empty: Form = {
  zone_name: "Dhaka City",
  shipping_type: "standard",
  base_cost: 60,
  per_kg_cost: 0,
  min_days: 1,
  max_days: 3,
  is_active: true,
};

function AdminShippingRates() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);

  const { data: rows, refetch } = useQuery({
    queryKey: ["admin-shipping-rates"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("shipping_rates")
        .select("*")
        .order("zone_name")
        .order("base_cost");
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
      zone_name: r.zone_name,
      shipping_type: r.shipping_type,
      base_cost: Number(r.base_cost),
      per_kg_cost: Number(r.per_kg_cost),
      min_days: r.min_days,
      max_days: r.max_days,
      is_active: r.is_active,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.zone_name || !form.shipping_type) {
      toast.error("Zone and type required");
      return;
    }
    const payload = {
      zone_name: form.zone_name.trim(),
      shipping_type: form.shipping_type.trim(),
      base_cost: Number(form.base_cost) || 0,
      per_kg_cost: Number(form.per_kg_cost) || 0,
      min_days: Math.max(0, Number(form.min_days) || 0),
      max_days: Math.max(0, Number(form.max_days) || 0),
      is_active: form.is_active,
    };
    const { error } = form.id
      ? await (supabase as any).from("shipping_rates").update(payload).eq("id", form.id)
      : await (supabase as any).from("shipping_rates").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved");
    setOpen(false);
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this rate?")) return;
    const { error } = await (supabase as any).from("shipping_rates").delete().eq("id", id);
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
          <h1 className="text-2xl font-bold">Shipping Rates</h1>
          <p className="text-sm text-muted-foreground mt-1">{rows?.length || 0} rates</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> Add Rate
        </Button>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Zone</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Base</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Per kg</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Days</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows?.map((r: any) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/30">
                    <td className="py-3 px-4">{r.zone_name}</td>
                    <td className="py-3 px-4 capitalize">{r.shipping_type.replace(/_/g, " ")}</td>
                    <td className="py-3 px-4">৳{r.base_cost}</td>
                    <td className="py-3 px-4 text-muted-foreground">৳{r.per_kg_cost}</td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {r.min_days}–{r.max_days}
                    </td>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Rate" : "New Rate"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Zone</Label>
                <Select
                  value={form.zone_name}
                  onValueChange={(v) => setForm({ ...form, zone_name: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dhaka City">Dhaka City</SelectItem>
                    <SelectItem value="Outside Dhaka">Outside Dhaka</SelectItem>
                    <SelectItem value="International">International</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type</Label>
                <Select
                  value={form.shipping_type}
                  onValueChange={(v) => setForm({ ...form, shipping_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="express">Express</SelectItem>
                    <SelectItem value="inside_dhaka">Inside Dhaka</SelectItem>
                    <SelectItem value="outside_dhaka">Outside Dhaka</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Base Cost (৳)</Label>
                <Input
                  type="number"
                  value={form.base_cost}
                  onChange={(e) => setForm({ ...form, base_cost: +e.target.value })}
                />
              </div>
              <div>
                <Label>Per kg (৳)</Label>
                <Input
                  type="number"
                  value={form.per_kg_cost}
                  onChange={(e) => setForm({ ...form, per_kg_cost: +e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Min Days</Label>
                <Input
                  type="number"
                  value={form.min_days}
                  onChange={(e) => setForm({ ...form, min_days: +e.target.value })}
                />
              </div>
              <div>
                <Label>Max Days</Label>
                <Input
                  type="number"
                  value={form.max_days}
                  onChange={(e) => setForm({ ...form, max_days: +e.target.value })}
                />
              </div>
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
