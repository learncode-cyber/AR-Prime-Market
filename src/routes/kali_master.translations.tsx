import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/kali_master/translations")({
  component: AdminTranslations,
});

type Form = {
  id?: string;
  language_code: string;
  content_key: string;
  translated_text: string;
};

const empty: Form = { language_code: "bn", content_key: "", translated_text: "" };

function AdminTranslations() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);
  const [filter, setFilter] = useState("");
  const [lang, setLang] = useState<string>("all");

  const { data: rows, refetch } = useQuery({
    queryKey: ["admin-translations"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("translations")
        .select("*")
        .order("content_key");
      if (error) {
        toast.error(error.message);
        return [];
      }
      return data || [];
    },
  });

  const filtered = (rows || []).filter((r: any) => {
    if (lang !== "all" && r.language_code !== lang) return false;
    if (
      filter &&
      !r.content_key.toLowerCase().includes(filter.toLowerCase()) &&
      !r.translated_text.toLowerCase().includes(filter.toLowerCase())
    )
      return false;
    return true;
  });

  const openCreate = () => {
    setForm(empty);
    setOpen(true);
  };
  const openEdit = (r: any) => {
    setForm({
      id: r.id,
      language_code: r.language_code,
      content_key: r.content_key,
      translated_text: r.translated_text,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.content_key || !form.translated_text) {
      toast.error("Key and text required");
      return;
    }
    const payload = {
      language_code: form.language_code.toLowerCase().trim(),
      content_key: form.content_key.trim(),
      translated_text: form.translated_text,
    };
    const { error } = form.id
      ? await (supabase as any).from("translations").update(payload).eq("id", form.id)
      : await (supabase as any)
          .from("translations")
          .upsert(payload, { onConflict: "language_code,content_key" });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved");
    setOpen(false);
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this translation?")) return;
    const { error } = await (supabase as any).from("translations").delete().eq("id", id);
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
          <h1 className="text-2xl font-bold">Translations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} of {rows?.length || 0} entries
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> Add Translation
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search key or text…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
        <Select value={lang} onValueChange={setLang}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All languages</SelectItem>
            <SelectItem value="bn">Bengali (bn)</SelectItem>
            <SelectItem value="en">English (en)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Lang</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Key</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Translation
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r: any) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/30">
                    <td className="py-3 px-4 font-mono text-xs uppercase">{r.language_code}</td>
                    <td className="py-3 px-4 font-mono text-xs">{r.content_key}</td>
                    <td className="py-3 px-4 max-w-md truncate">{r.translated_text}</td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
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
            <DialogTitle>{form.id ? "Edit Translation" : "New Translation"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Language</Label>
                <Select
                  value={form.language_code}
                  onValueChange={(v) => setForm({ ...form, language_code: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bn">Bengali (bn)</SelectItem>
                    <SelectItem value="en">English (en)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Content Key</Label>
                <Input
                  value={form.content_key}
                  onChange={(e) => setForm({ ...form, content_key: e.target.value })}
                  placeholder="product.title.abc123"
                />
              </div>
            </div>
            <div>
              <Label>Translated Text</Label>
              <Textarea
                rows={4}
                value={form.translated_text}
                onChange={(e) => setForm({ ...form, translated_text: e.target.value })}
              />
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
