import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { AdminPending, AdminErrorComponent } from "@/lib/admin-route-boundaries";
import {
  listHomeCategoryCardsAdmin,
  upsertHomeCategoryCard,
  deleteHomeCategoryCard,
  upsertHomeCategoryCardItem,
  deleteHomeCategoryCardItem,
  reorderHomeCategoryCards,
  type HomeCategoryCard,
  type HomeCategoryItem,
} from "@/lib/home-categories.functions";

export const Route = createFileRoute("/kali_master/home-categories")({
  component: HomeCategoriesAdmin,
  pendingComponent: () => <AdminPending label="Loading home categories…" />,
  errorComponent: AdminErrorComponent,
});

function HomeCategoriesAdmin() {
  const qc = useQueryClient();
  const list = useServerFn(listHomeCategoryCardsAdmin);
  const upsert = useServerFn(upsertHomeCategoryCard);
  const remove = useServerFn(deleteHomeCategoryCard);
  const reorder = useServerFn(reorderHomeCategoryCards);

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["home-category-cards", "admin"],
    queryFn: () => list(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["home-category-cards"] });
  };

  const saveMut = useMutation({
    mutationFn: (data: {
      id?: string;
      title: string;
      cta_label: string;
      target_slug: string;
      position: number;
      is_active: boolean;
    }) => upsert({ data }),
    onSuccess: () => {
      invalidate();
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderMut = useMutation({
    mutationFn: (ids: string[]) => reorder({ data: { ids } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const [editing, setEditing] = useState<HomeCategoryCard | null>(null);
  const [creating, setCreating] = useState(false);

  function move(idx: number, dir: -1 | 1) {
    const next = [...cards];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    reorderMut.mutate(next.map((c) => c.id));
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-6xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Home Categories</h1>
          <p className="text-sm text-muted-foreground">
            হোমপেজের Amazon-style ক্যাটাগরি সেকশন — কার্ড add/edit/remove/reorder সব এখান থেকে।
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Card
        </Button>
      </header>

      {isLoading ? (
        <AdminPending />
      ) : cards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No cards yet — add one to populate the home page section.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {cards.map((card, idx) => (
            <Card key={card.id} className={card.is_active ? "" : "opacity-60"}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    <span className="truncate">{card.title}</span>
                    {card.is_active ? (
                      <Badge variant="secondary" className="text-[10px]">
                        <Eye className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        <EyeOff className="w-3 h-3 mr-1" />
                        Hidden
                      </Badge>
                    )}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    → /categories/{card.target_slug} · {card.items.length} item
                    {card.items.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={idx === 0 || reorderMut.isPending}
                    onClick={() => move(idx, -1)}
                  >
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={idx === cards.length - 1 || reorderMut.isPending}
                    onClick={() => move(idx, 1)}
                  >
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditing(card)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      if (confirm(`Delete "${card.title}" and all its items?`))
                        deleteMut.mutate(card.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-4 gap-2">
                  {card.items.slice(0, 4).map((it) => (
                    <div
                      key={it.id}
                      className="aspect-square rounded bg-secondary/40 overflow-hidden relative"
                    >
                      {it.image_url ? (
                        <img
                          src={it.image_url}
                          alt={it.label}
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                      <span className="absolute bottom-0 inset-x-0 text-[10px] bg-black/60 text-white px-1 py-0.5 truncate">
                        {it.label}
                      </span>
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, 4 - card.items.length) }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="aspect-square rounded border border-dashed border-border"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(editing || creating) && (
        <CardEditor
          initial={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaveCard={(payload) => saveMut.mutateAsync(payload)}
          onReload={invalidate}
        />
      )}
    </div>
  );
}

function CardEditor({
  initial,
  onClose,
  onSaveCard,
  onReload,
}: {
  initial: HomeCategoryCard | null;
  onClose: () => void;
  onSaveCard: (data: {
    id?: string;
    title: string;
    cta_label: string;
    target_slug: string;
    position: number;
    is_active: boolean;
  }) => Promise<{ id: string }>;
  onReload: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [ctaLabel, setCtaLabel] = useState(initial?.cta_label ?? "See more");
  const [targetSlug, setTargetSlug] = useState(initial?.target_slug ?? "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [cardId, setCardId] = useState(initial?.id);
  const [items, setItems] = useState<HomeCategoryItem[]>(initial?.items ?? []);

  const upsertItem = useServerFn(upsertHomeCategoryCardItem);
  const deleteItem = useServerFn(deleteHomeCategoryCardItem);

  async function saveCard() {
    if (!title.trim() || !targetSlug.trim()) {
      toast.error("Title and target slug are required");
      return;
    }
    const res = await onSaveCard({
      id: cardId,
      title: title.trim(),
      cta_label: ctaLabel.trim() || "See more",
      target_slug: targetSlug.trim(),
      position: initial?.position ?? 999,
      is_active: isActive,
    });
    setCardId(res.id);
    return res.id;
  }

  async function addItem() {
    let id = cardId;
    if (!id) {
      id = await saveCard();
      if (!id) return;
    }
    setItems((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        card_id: id!,
        label: "New item",
        image_url: "",
        search_query: null,
        target_slug: null,
        position: prev.length,
      },
    ]);
  }

  async function saveItem(it: HomeCategoryItem) {
    if (!it.image_url) {
      toast.error("Image required");
      return;
    }
    const payload: {
      id?: string;
      card_id: string;
      label: string;
      image_url: string;
      search_query: string | null;
      target_slug: string | null;
      position: number;
    } = {
      card_id: it.card_id,
      label: it.label,
      image_url: it.image_url,
      search_query: it.search_query,
      target_slug: it.target_slug,
      position: it.position,
    };
    if (!it.id.startsWith("new-")) payload.id = it.id;
    try {
      const res = await upsertItem({ data: payload });
      setItems((prev) => prev.map((p) => (p.id === it.id ? { ...it, id: res.id } : p)));
      toast.success("Item saved");
      onReload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function removeItem(it: HomeCategoryItem) {
    if (!confirm(`Remove "${it.label}"?`)) return;
    if (!it.id.startsWith("new-")) {
      try {
        await deleteItem({ data: { id: it.id } });
      } catch (e) {
        toast.error((e as Error).message);
        return;
      }
    }
    setItems((prev) => prev.filter((p) => p.id !== it.id));
    onReload();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit card" : "Add new card"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Level up your beauty routine"
              />
            </div>
            <div>
              <Label>Target category slug</Label>
              <Input
                value={targetSlug}
                onChange={(e) => setTargetSlug(e.target.value)}
                placeholder="beauty"
              />
            </div>
            <div>
              <Label>CTA label</Label>
              <Input
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                placeholder="See more"
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={isActive} onCheckedChange={setIsActive} id="active" />
              <Label htmlFor="active">Active (visible on home page)</Label>
            </div>
          </div>

          <Button onClick={saveCard} size="sm">
            <Save className="w-4 h-4 mr-2" />
            Save card details
          </Button>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">Items ({items.length}/4 shown on site)</h4>
              <Button onClick={addItem} size="sm" variant="outline" disabled={items.length >= 8}>
                <Plus className="w-4 h-4 mr-1" /> Add item
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((it, idx) => (
                <Card key={it.id} className="p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr_auto] gap-3 items-start">
                    <div className="w-full sm:w-[120px]">
                      <ImageUploadField
                        value={it.image_url}
                        onChange={(url) =>
                          setItems((prev) =>
                            prev.map((p) => (p.id === it.id ? { ...p, image_url: url } : p)),
                          )
                        }
                        bucket="category-images"
                        pathPrefix="home-cards"
                        preview
                      />
                    </div>
                    <div className="space-y-2">
                      <Input
                        value={it.label}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((p) => (p.id === it.id ? { ...p, label: e.target.value } : p)),
                          )
                        }
                        placeholder="Label (e.g. Makeup)"
                      />
                      <Input
                        value={it.target_slug ?? ""}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((p) =>
                              p.id === it.id ? { ...p, target_slug: e.target.value || null } : p,
                            ),
                          )
                        }
                        placeholder="Override slug (optional)"
                      />
                      <Input
                        type="number"
                        value={it.position}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((p) =>
                              p.id === it.id ? { ...p, position: Number(e.target.value) || 0 } : p,
                            ),
                          )
                        }
                        placeholder="Position"
                        className="w-24"
                      />
                    </div>
                    <div className="flex sm:flex-col gap-1">
                      <Button size="sm" onClick={() => saveItem(it)}>
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => removeItem(it)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
              {items.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No items yet — add up to 4.
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
