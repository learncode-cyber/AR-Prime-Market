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
import { Plus, Edit, Trash2, Copy, GitMerge } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { ImageUploadField } from "@/components/admin/ImageUploadField";

function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/s$/, "");
}
function similarity(a: string, b: string) {
  const na = normalize(a),
    nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.92;
  const bigrams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const ba = bigrams(na),
    bb = bigrams(nb);
  if (!ba.size || !bb.size) return 0;
  let inter = 0;
  ba.forEach((g) => {
    if (bb.has(g)) inter++;
  });
  return (2 * inter) / (ba.size + bb.size);
}

export const Route = createFileRoute("/kali_master/categories")({
  component: AdminCategories,
});

type Form = { id?: string; name: string; slug: string; description: string; image_url: string };
const empty: Form = { name: "", slug: "", description: "", image_url: "" };

function AdminCategories() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);

  const { data: categories, refetch } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("name");
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
      name: c.name,
      slug: c.slug,
      description: c.description || "",
      image_url: c.image_url || "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.slug) {
      toast.error("Name ও Slug দরকার");
      return;
    }
    const payload = {
      name: form.name,
      slug: form.slug,
      description: form.description || null,
      image_url: form.image_url || null,
    };
    const { error } = form.id
      ? await supabase.from("categories").update(payload).eq("id", form.id)
      : await supabase.from("categories").insert(payload);
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
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      refetch();
    }
  };

  // Duplicate detection
  const duplicatePairs = useMemo(() => {
    const list = categories || [];
    const pairs: { a: any; b: any; score: number }[] = [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const score = Math.max(
          similarity(list[i].name, list[j].name),
          similarity(list[i].slug, list[j].slug),
        );
        if (score >= 0.6) pairs.push({ a: list[i], b: list[j], score });
      }
    }
    return pairs.sort((x, y) => y.score - x.score);
  }, [categories]);

  const handleMerge = async (
    sourceId: string,
    targetId: string,
    sourceName: string,
    targetName: string,
  ) => {
    if (
      !confirm(
        `Merge "${sourceName}" into "${targetName}"?\n\nAll products will move to "${targetName}", then "${sourceName}" will be deleted.`,
      )
    )
      return;
    const { error: upErr, count } = await supabase
      .from("products")
      .update({ category_id: targetId }, { count: "exact" })
      .eq("category_id", sourceId);
    if (upErr) {
      toast.error(`Move failed: ${upErr.message}`);
      return;
    }
    const { error: delErr } = await supabase.from("categories").delete().eq("id", sourceId);
    if (delErr) {
      toast.error(`Delete failed: ${delErr.message}`);
      return;
    }
    toast.success(`Merged: ${count || 0} products moved, "${sourceName}" deleted`);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {categories?.length || 0} categories
            {duplicatePairs.length > 0 && (
              <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">
                · {duplicatePairs.length} possible duplicate{duplicatePairs.length > 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> Add Category
        </Button>
      </div>

      {duplicatePairs.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Copy className="w-4 h-4 text-amber-600" />
              <h2 className="font-semibold">Possible Duplicate Categories</h2>
            </div>
            <div className="space-y-2">
              {duplicatePairs.map((p, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background p-3"
                >
                  <div className="text-sm">
                    <span className="font-medium">{p.a.name}</span>
                    <span className="text-muted-foreground"> ({p.a.slug})</span>
                    <span className="mx-2 text-muted-foreground">↔</span>
                    <span className="font-medium">{p.b.name}</span>
                    <span className="text-muted-foreground"> ({p.b.slug})</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      match {Math.round(p.score * 100)}%
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMerge(p.a.id, p.b.id, p.a.name, p.b.name)}
                    >
                      <GitMerge className="w-3.5 h-3.5 mr-1" /> Merge → {p.b.name}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMerge(p.b.id, p.a.id, p.b.name, p.a.name)}
                    >
                      <GitMerge className="w-3.5 h-3.5 mr-1" /> Merge → {p.a.name}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Merge moves all products from the source category into the target, then deletes the
              source.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Slug</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Description
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {categories?.map((c) => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/30">
                    <td className="py-3 px-4 font-medium">{c.name}</td>
                    <td className="py-3 px-4 text-muted-foreground font-mono text-xs">{c.slug}</td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">
                      {c.description || "—"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
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
            <DialogTitle>{form.id ? "Edit Category" : "New Category"}</DialogTitle>
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
              <Label>Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Image</Label>
              <ImageUploadField
                value={form.image_url}
                onChange={(url) => setForm({ ...form, image_url: url })}
                bucket="category-images"
                pathPrefix={form.slug || "category"}
                placeholder="https://… or click Upload"
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
