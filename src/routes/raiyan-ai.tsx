import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Plus, MessageSquare, Trash2, Sparkles, Loader2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/context/AuthContext";
import { listThreads, createThread, deleteThread, renameThread } from "@/lib/raiyan-ai.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/raiyan-ai")({
  head: () => ({
    meta: [
      { title: "Raiyan AI — AR Prime Market" },
      { name: "description", content: "AI-powered shopping assistant for AR Prime Market." },
    ],
  }),
  component: RaiyanAILayout,
});

function RaiyanAILayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { threadId?: string };
  const queryClient = useQueryClient();

  const listFn = useServerFn(listThreads);
  const createFn = useServerFn(createThread);
  const deleteFn = useServerFn(deleteThread);
  const renameFn = useServerFn(renameThread);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-threads"],
    queryFn: () => listFn(),
    enabled: !!user,
  });

  const createMut = useMutation({
    mutationFn: () => createFn({ data: {} }),
    onSuccess: (t) => {
      queryClient.invalidateQueries({ queryKey: ["ai-threads"] });
      navigate({ to: "/raiyan-ai/$threadId", params: { threadId: t.id } });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: (_d, id) => {
      queryClient.invalidateQueries({ queryKey: ["ai-threads"] });
      if (params.threadId === id) {
        navigate({ to: "/raiyan-ai" });
      }
    },
  });

  const renameMut = useMutation({
    mutationFn: (vars: { id: string; title: string }) => renameFn({ data: vars }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-threads"] }),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  const startRename = (id: string, current: string) => {
    setEditingId(id);
    setEditTitle(current);
  };
  const commitRename = () => {
    if (!editingId) return;
    const title = editTitle.trim();
    if (title.length > 0) renameMut.mutate({ id: editingId, title });
    setEditingId(null);
  };

  const [didAutoCreate, setDidAutoCreate] = useState(false);
  useEffect(() => {
    if (didAutoCreate) return;
    if (!user || isLoading) return;
    if (params.threadId) return;
    if (!data) return;
    if (data.threads.length === 0) {
      setDidAutoCreate(true);
      createMut.mutate();
    } else {
      navigate({
        to: "/raiyan-ai/$threadId",
        params: { threadId: data.threads[0].id },
        replace: true,
      });
    }
  }, [user, isLoading, data, params.threadId, didAutoCreate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-20 px-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Raiyan AI</h1>
        <p className="text-muted-foreground mb-6">
          AR Prime Market-এর AI shopping assistant ব্যবহার করতে লগইন করুন।
        </p>
        <Link
          to="/login"
          className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:brightness-110"
        >
          Login করুন
        </Link>
      </div>
    );
  }

  return (
    <div className="dark relative min-h-[calc(100vh-3.5rem)] overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 [background-image:linear-gradient(hsl(var(--primary)/0.08)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--primary)/0.08)_1px,transparent_1px),radial-gradient(circle_at_20%_0%,hsl(var(--primary)/0.16),transparent_34%)] [background-size:34px_34px,34px_34px,100%_100%]" />
      <div className="relative mx-auto max-w-[1540px] px-2 py-3 sm:px-4 sm:py-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px_minmax(0,1fr)] min-h-[calc(100vh-7rem)]">
          <aside className="flex flex-col rounded-3xl border border-primary/25 bg-card/70 p-3 shadow-[0_0_44px_-14px_hsl(var(--primary)/0.72)] backdrop-blur-2xl md:sticky md:top-20 md:h-[calc(100vh-8rem)]">
            <div className="mb-4 flex items-center justify-between rounded-2xl border border-primary/15 bg-primary/5 p-2.5">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <span className="relative w-9 h-9 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center ring-2 ring-primary/35 shadow-[0_0_18px_-2px_hsl(var(--primary)/0.75)]">
                  <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
                </span>
                <span className="bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
                  Raiyan AI
                </span>
              </h2>
              <Button
                size="sm"
                onClick={() => createMut.mutate()}
                disabled={createMut.isPending}
                className="rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-[0_0_18px_-4px_hsl(var(--primary)/0.7)] hover:shadow-[0_0_28px_-4px_hsl(var(--primary)/0.9)]"
              >
                <Plus className="w-4 h-4 mr-1" /> New
              </Button>
            </div>
            <div className="space-y-1.5 flex-1 overflow-y-auto pr-1 scrollbar-hide">
              {(data?.threads ?? []).map((t) => {
                const isEditing = editingId === t.id;
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "group flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm transition-all border border-transparent",
                      !isEditing &&
                        "cursor-pointer hover:bg-primary/10 hover:border-primary/25 hover:shadow-[0_0_18px_-10px_hsl(var(--primary)/0.75)]",
                      params.threadId === t.id &&
                        "bg-gradient-to-r from-primary/20 to-primary/5 border-primary/35 shadow-[0_0_20px_-8px_hsl(var(--primary)/0.75)]",
                    )}
                    onClick={() => {
                      if (!isEditing)
                        navigate({ to: "/raiyan-ai/$threadId", params: { threadId: t.id } });
                    }}
                  >
                    <MessageSquare className="w-4 h-4 shrink-0 text-muted-foreground" />
                    {isEditing ? (
                      <>
                        <input
                          ref={editInputRef}
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitRename();
                            }
                            if (e.key === "Escape") {
                              e.preventDefault();
                              setEditingId(null);
                            }
                          }}
                          className="flex-1 min-w-0 bg-background border border-border rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            commitRename();
                          }}
                          className="text-primary"
                          aria-label="Save"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(null);
                          }}
                          className="text-muted-foreground"
                          aria-label="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 truncate">{t.title || "New chat"}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startRename(t.id, t.title || "");
                          }}
                          className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-muted-foreground hover:text-primary transition p-1.5 -m-1 touch-manipulation"
                          aria-label="Rename thread"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete(t.id);
                          }}
                          className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-muted-foreground hover:text-destructive transition p-1.5 -m-1 touch-manipulation"
                          aria-label="Delete thread"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
              {(!data?.threads || data.threads.length === 0) && !createMut.isPending && (
                <p className="text-xs text-muted-foreground px-2 py-4">কোনো কথোপকথন নেই</p>
              )}
            </div>
          </aside>
          <main className="min-h-[70vh] min-w-0">
            <Outlet />
          </main>
        </div>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>কথোপকথন মুছবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              এই thread এবং এর সব message permanently মুছে যাবে। এটি undo করা যাবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) deleteMut.mutate(confirmDelete);
                setConfirmDelete(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              মুছুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
