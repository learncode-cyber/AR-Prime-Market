import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/kali_master/content")({
  component: AdminContent,
});

type Form = { id?: string; section_name: string; content_data: string; is_active: boolean };
const empty: Form = { section_name: "", content_data: "{\n  \n}", is_active: true };

function AdminContent() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);

  const { data: items, refetch } = useQuery({
    queryKey: ["admin-content"],
    queryFn: async () => {
      const { data } = await supabase.from("site_content").select("*").order("section_name");
      return data || [];
    },
  });

  const openCreate = () => {
    setForm(empty);
    setOpen(true);
  };
  const openEdit = (c: any) => {
    setForm({
      id: c.id,
      section_name: c.section_name || "",
      content_data: JSON.stringify(c.content_data ?? {}, null, 2),
      is_active: c.is_active,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.section_name) {
      toast.error("Section name দরকার");
      return;
    }
    let parsed: any;
    try {
      parsed = JSON.parse(form.content_data || "{}");
    } catch {
      toast.error("Invalid JSON");
      return;
    }
    const payload = {
      section_name: form.section_name,
      content_data: parsed,
      is_active: form.is_active,
    };
    const { error } = form.id
      ? await supabase.from("site_content").update(payload).eq("id", form.id)
      : await supabase.from("site_content").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved");
    setOpen(false);
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete?")) return;
    const { error } = await supabase.from("site_content").delete().eq("id", id);
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
          <h1 className="text-2xl font-bold">Site Content</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hero banners, promotions, page sections — JSON content
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> Add Section
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items?.map((c: any) => (
          <Card key={c.id} className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-mono">{c.section_name}</CardTitle>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-secondary/50 rounded p-2 overflow-x-auto max-h-40">
                {JSON.stringify(c.content_data, null, 2)}
              </pre>
              <p className="text-xs text-muted-foreground mt-2">
                {c.is_active ? "✓ Active" : "Inactive"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Section" : "New Section"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Section Name</Label>
              <Input
                value={form.section_name}
                onChange={(e) => setForm({ ...form, section_name: e.target.value })}
                placeholder="hero_banner"
              />
            </div>
            <div>
              <Label>Content (JSON)</Label>
              <Textarea
                rows={12}
                className="font-mono text-xs"
                value={form.content_data}
                onChange={(e) => setForm({ ...form, content_data: e.target.value })}
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
