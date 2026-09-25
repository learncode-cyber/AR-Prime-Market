import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, History, Loader2, Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type StoredMessage = {
  id: string;
  message: string;
  created_at: string | null;
  sender_id: string | null;
  session_id: string | null;
  metadata: { sender_type?: "user" | "agent" } | null;
};

type SessionPreview = {
  id: string;
  created_at: string | null;
  status: string | null;
  subject: string | null;
  preview: string;
};

const GUEST_MESSAGES_KEY = "ar-pm-floating-chat-messages";
const welcomeMessage =
  "👋 Hello! Raiyan support is here. Ask anything about products, order help, or open the full AI assistant.";

export const ChatWidget = ({ embedded = false }: { embedded?: boolean }) => {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pastSessions, setPastSessions] = useState<SessionPreview[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const guestMessage = (text: string, sender_type: "user" | "agent"): StoredMessage => ({
    id: crypto.randomUUID(),
    message: text,
    sender_id: sender_type === "user" ? "guest" : null,
    session_id: "guest",
    created_at: new Date().toISOString(),
    metadata: { sender_type },
  });

  const saveGuestMessages = (items: StoredMessage[]) => {
    localStorage.setItem(GUEST_MESSAGES_KEY, JSON.stringify(items.slice(-80)));
  };

  useEffect(() => {
    if (!embedded) return;
    const init = async () => {
      if (!user) {
        const cached = localStorage.getItem(GUEST_MESSAGES_KEY);
        if (cached) {
          try {
            setMessages(JSON.parse(cached));
            return;
          } catch {
            localStorage.removeItem(GUEST_MESSAGES_KEY);
          }
        }
        setMessages([guestMessage(welcomeMessage, "agent")]);
        return;
      }

      const { data: existing } = await supabase
        .from("chat_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        setSessionId(existing.id);
        return;
      }

      const { data: created } = await supabase
        .from("chat_sessions")
        .insert({ user_id: user.id, subject: "Raiyan widget", status: "active" })
        .select("id")
        .single();
      if (created?.id) setSessionId(created.id);
    };
    init();
  }, [embedded, user]);

  useEffect(() => {
    if (!sessionId || !user) return;
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("id, message, created_at, sender_id, session_id, metadata")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      const rows = (data as StoredMessage[] | null) ?? [];
      setMessages(rows.length > 0 ? rows : [guestMessage(welcomeMessage, "agent")]);
    };
    fetchMessages();

    const channel = supabase
      .channel(`floating-chat-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.some((m) => m.id === (payload.new as StoredMessage).id)
              ? prev
              : [...prev, payload.new as StoredMessage],
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const loadPastSessions = useCallback(async () => {
    if (!user) return;
    setLoadingHistory(true);
    const { data: sessions } = await supabase
      .from("chat_sessions")
      .select("id, created_at, status, subject")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(20);

    const withPreview = await Promise.all(
      (sessions ?? []).map(async (session) => {
        const { data: first } = await supabase
          .from("chat_messages")
          .select("message")
          .eq("session_id", session.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        return {
          ...session,
          preview: first?.message?.slice(0, 72) || session.subject || "New conversation",
        };
      }),
    );
    setPastSessions(withPreview);
    setLoadingHistory(false);
  }, [user]);

  const startNewSession = async () => {
    if (!user) {
      const fresh = [guestMessage(welcomeMessage, "agent")];
      setMessages(fresh);
      saveGuestMessages(fresh);
      return;
    }

    if (sessionId)
      await supabase.from("chat_sessions").update({ status: "closed" }).eq("id", sessionId);
    const { data: created } = await supabase
      .from("chat_sessions")
      .insert({ user_id: user.id, subject: "Raiyan widget", status: "active" })
      .select("id")
      .single();
    if (created?.id) {
      setSessionId(created.id);
      setMessages([guestMessage(welcomeMessage, "agent")]);
      setShowHistory(false);
    }
  };

  const switchToSession = async (id: string) => {
    setSessionId(id);
    setShowHistory(false);
  };

  const handleSend = async () => {
    const content = message.trim();
    if (!content || sending) return;
    setMessage("");
    setSending(true);

    const userMsg = guestMessage(content, "user");

    // Optimistically show user message
    let history: StoredMessage[] = [];
    setMessages((prev) => {
      history = [...prev, userMsg];
      if (!user || !sessionId) saveGuestMessages(history);
      return history;
    });

    if (user && sessionId) {
      await supabase.from("chat_messages").insert({
        session_id: sessionId,
        sender_id: user.id,
        message: content,
        metadata: { sender_type: "user" },
      });
    }

    // Call AI support function
    let replyText =
      "দুঃখিত, এই মুহূর্তে উত্তর দিতে পারছি না। অনুগ্রহ করে আবার চেষ্টা করুন বা Full Raiyan AI খুলুন।";
    try {
      const convo = history.slice(-12).map((m) => ({
        role:
          (m.metadata?.sender_type ?? (m.sender_id ? "user" : "agent")) === "user"
            ? "user"
            : "assistant",
        content: m.message,
      }));
      const { data, error } = await supabase.functions.invoke("ai-support-chat", {
        body: { messages: convo },
      });
      if (!error && data?.reply) replyText = data.reply as string;
    } catch {
      // keep fallback
    }

    const reply = guestMessage(replyText, "agent");
    if (user && sessionId) {
      await supabase.from("chat_messages").insert({
        session_id: sessionId,
        message: reply.message,
        metadata: { sender_type: "agent" },
      });
      await supabase
        .from("chat_sessions")
        .update({ updated_at: new Date().toISOString(), subject: content.slice(0, 80) })
        .eq("id", sessionId);
    } else {
      setMessages((prev) => {
        const next = [...prev, reply];
        saveGuestMessages(next);
        return next;
      });
    }
    setSending(false);
  };

  if (!embedded) return null;

  if (showHistory) {
    return (
      <div className="flex h-full flex-col bg-card text-card-foreground">
        <div className="flex items-center gap-2 border-b border-primary/15 bg-primary/5 p-3">
          <button
            type="button"
            onClick={() => setShowHistory(false)}
            className="rounded-lg p-1.5 transition-colors hover:bg-secondary"
            aria-label="Back to chat"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold">Chat History</span>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto h-7 rounded-full text-xs"
            onClick={startNewSession}
          >
            New Chat
          </Button>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {loadingHistory ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading history...</div>
          ) : pastSessions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No past conversations yet
            </div>
          ) : (
            pastSessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => switchToSession(session.id)}
                className="w-full rounded-2xl border border-primary/15 bg-secondary/50 p-3 text-left transition hover:border-primary/30 hover:bg-primary/10"
              >
                <div className="mb-1 flex items-center justify-between text-xs font-medium">
                  <span>
                    {session.created_at
                      ? new Date(session.created_at).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })
                      : "Chat"}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                    {session.status ?? "active"}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{session.preview}</p>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-card text-card-foreground">
      <div className="flex items-center gap-2 px-3 pt-2">
        <Link
          to="/raiyan-ai"
          className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary/15"
        >
          <Sparkles className="h-3 w-3" /> Full Raiyan AI <ExternalLink className="h-3 w-3" />
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={startNewSession}
            className="rounded-lg px-2 py-1 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            New Chat
          </button>
          {user && (
            <button
              type="button"
              onClick={() => {
                setShowHistory(true);
                loadPastSessions();
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <History className="h-3 w-3" /> History
            </button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="min-h-[220px] flex-1 space-y-2 overflow-y-auto p-3 [background-image:radial-gradient(circle_at_1px_1px,hsl(var(--primary)/0.08)_1px,transparent_0)] [background-size:22px_22px]"
      >
        {messages.map((item) => {
          const sender = item.metadata?.sender_type ?? (item.sender_id ? "user" : "agent");
          const isUser = sender === "user";
          return (
            <div key={item.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                  isUser
                    ? "rounded-br-sm bg-primary text-primary-foreground shadow-primary/20"
                    : "rounded-bl-sm border border-primary/15 bg-secondary/80 text-foreground",
                )}
              >
                {isUser ? (
                  item.message
                ) : (
                  <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:m-0">
                    <ReactMarkdown>{item.message}</ReactMarkdown>
                  </div>
                )}
                <p
                  className={cn(
                    "mt-1 text-[9px]",
                    isUser ? "text-primary-foreground/65" : "text-muted-foreground",
                  )}
                >
                  {item.created_at
                    ? new Date(item.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "now"}
                </p>
              </div>
            </div>
          );
        })}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-primary/15 bg-secondary/80 px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex gap-2 border-t border-primary/15 bg-background/70 p-3 backdrop-blur-xl"
      >
        <Input
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="h-10 rounded-full border-primary/20 bg-background/80 text-sm focus-visible:ring-primary/50"
          disabled={sending}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!message.trim() || sending}
          className="h-10 w-10 rounded-full shadow-lg shadow-primary/20"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
};
