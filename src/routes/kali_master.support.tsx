import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Circle, Loader2, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/kali_master/support")({
  component: AdminSupportPage,
});

type Session = {
  id: string;
  user_id: string | null;
  subject: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  profiles?: { email: string | null } | null;
};

type Message = {
  id: string;
  session_id: string | null;
  sender_id: string | null;
  message: string;
  created_at: string | null;
  metadata: { sender_type?: "user" | "agent" } | null;
};

function AdminSupportPage() {
  const { user } = useAuth();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial sessions load
  useQuery({
    queryKey: ["admin-chat-sessions-initial"],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_sessions")
        .select("*, profiles:user_id(email)")
        .order("updated_at", { ascending: false })
        .limit(100);
      setSessions((data as any[]) || []);
      return data;
    },
  });

  // Realtime: subscribe to ALL chat_sessions and chat_messages (admin RLS allows)
  useEffect(() => {
    const channel = supabase
      .channel("admin-support-global")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_sessions" },
        async (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const next = payload.new as Session;
            // Fetch profile email
            let profileEmail: string | null = null;
            if (next.user_id) {
              const { data: p } = await supabase
                .from("profiles")
                .select("email")
                .eq("id", next.user_id)
                .maybeSingle();
              profileEmail = p?.email || null;
            }
            const enriched = { ...next, profiles: { email: profileEmail } };
            setSessions((prev) => {
              const idx = prev.findIndex((s) => s.id === next.id);
              if (idx === -1) return [enriched, ...prev];
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...enriched };
              // Re-sort by updated_at desc
              return copy.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
            });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const m = payload.new as Message;
          if (m.session_id === activeSessionId) {
            setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          }
          // Bump session to top
          setSessions((prev) => {
            const idx = prev.findIndex((s) => s.id === m.session_id);
            if (idx === -1) return prev;
            const copy = [...prev];
            copy[idx] = { ...copy[idx], updated_at: m.created_at };
            return [copy[idx], ...copy.filter((_, i) => i !== idx)];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSessionId]);

  // Load messages when session changes
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", activeSessionId)
        .order("created_at", { ascending: true });
      if (!cancelled) setMessages((data as any[]) || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSessionId]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendReply = async () => {
    const content = reply.trim();
    if (!content || !activeSessionId || !user || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.from("chat_messages").insert({
        session_id: activeSessionId,
        sender_id: user.id,
        message: content,
        metadata: { sender_type: "agent" },
      });
      if (error) throw error;
      await supabase
        .from("chat_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", activeSessionId);
      setReply("");
    } catch (err: unknown) {
      toast.error((err instanceof Error ? err.message : String(err)) || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const closeSession = async () => {
    if (!activeSessionId) return;
    await supabase.from("chat_sessions").update({ status: "closed" }).eq("id", activeSessionId);
    toast.success("Session closed");
  };

  const active = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display font-bold text-2xl text-foreground">Support Center</h1>
        <p className="text-sm text-muted-foreground">
          Real-time customer chat — replies sync instantly.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-220px)] min-h-[500px]">
        {/* Sessions list */}
        <Card className="md:col-span-1 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border bg-secondary/30">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Conversations ({sessions.length})
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sessions.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No sessions yet</p>
            ) : (
              sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSessionId(s.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-border/50 hover:bg-secondary/40 transition-colors",
                    activeSessionId === s.id && "bg-primary/10 hover:bg-primary/15",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground truncate flex-1">
                      {s.profiles?.email || s.user_id?.slice(0, 8) || "Guest"}
                    </span>
                    {s.status === "open" || s.status === "active" ? (
                      <Circle className="w-2 h-2 fill-green-500 text-green-500 shrink-0" />
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {s.subject || "New conversation"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {s.updated_at
                      ? new Date(s.updated_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </p>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Chat area */}
        <Card className="md:col-span-2 overflow-hidden flex flex-col">
          {!activeSessionId ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select a conversation to start replying
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <UserIcon className="w-4 h-4" /> {active?.profiles?.email || "Customer"}
                  </p>
                  <p className="text-xs text-muted-foreground">{active?.subject}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {active?.status}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={closeSession}>
                    Close
                  </Button>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">No messages yet</p>
                ) : (
                  messages.map((m) => {
                    const isAgent = m.metadata?.sender_type === "agent" || m.sender_id === user?.id;
                    return (
                      <div
                        key={m.id}
                        className={cn("flex", isAgent ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                            isAgent
                              ? "rounded-br-sm bg-primary text-primary-foreground"
                              : "rounded-bl-sm border border-border bg-secondary/80 text-foreground",
                          )}
                        >
                          <p className="whitespace-pre-wrap">{m.message}</p>
                          <p
                            className={cn(
                              "mt-1 text-[10px]",
                              isAgent ? "text-primary-foreground/70" : "text-muted-foreground",
                            )}
                          >
                            {m.created_at
                              ? new Date(m.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "now"}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendReply();
                }}
                className="flex gap-2 border-t border-border bg-background/70 p-3"
              >
                <Input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type your reply..."
                  disabled={sending}
                  className="h-10"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!reply.trim() || sending}
                  className="h-10 w-10"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
