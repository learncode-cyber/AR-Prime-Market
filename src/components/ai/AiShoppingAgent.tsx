import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useLocation, Link } from "@tanstack/react-router";
import {
  Sparkles,
  Send,
  X,
  Loader2,
  Trash2,
  ExternalLink,
  ShoppingBag,
  MessageCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { setAiOpen } from "@/lib/ai-stack";

const GREETING_DELAY_MS = 3000;

function detectGreeting(): string {
  if (typeof navigator === "undefined") {
    return "🔥 Welcome to AR Prime Market! Ask me about any product, shipping, or discount codes. 🤖✨";
  }
  const lang = (navigator.language || "en").toLowerCase();
  if (lang.startsWith("bn")) {
    return "🔥 AR Prime Market-এ আপনাকে স্বাগতম! যেকোনো প্রোডাক্টের বিষয়ে জানতে বা ডিসকাউন্ট কোড পেতে আমাকে জিজ্ঞেস করুন। 🤖✨";
  }
  if (lang.startsWith("ar")) {
    return "🔥 أهلاً بك في AR Prime Market! اسألني عن أي منتج، الشحن، أو أكواد الخصم. 🤖✨";
  }
  return "🔥 Welcome to AR Prime Market! Ask me about any product, shipping, or discount codes. 🤖✨";
}

const STORAGE_KEY = "arpm-shopping-agent-history-v1";
const MAX_STORED = 30;

type ProductCtx = { title: string; slug: string; price: number; rating?: number } | null;

function useProductContext(pathname: string): ProductCtx {
  const [ctx, setCtx] = useState<ProductCtx>(null);
  useEffect(() => {
    const match = pathname.match(/^\/products\/([^/?#]+)$/);
    if (!match) {
      setCtx(null);
      return;
    }
    const slug = decodeURIComponent(match[1]);
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("title, slug, price, rating")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (cancelled) return;
      if (data)
        setCtx({
          title: data.title,
          slug: data.slug,
          price: Number(data.price),
          rating: Number(data.rating ?? 0),
        });
      else setCtx(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);
  return ctx;
}

function loadHistory(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UIMessage[]) : [];
  } catch {
    return [];
  }
}

const SUGGESTIONS = [
  "Recommend a gadget under $50",
  "Best skincare picks",
  "Shipping to USA?",
  "Track my order",
];

export function AiShoppingAgent() {
  const enabled = useFeatureFlag("ai_shopping_agent", true);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [initialMessages] = useState<UIMessage[]>(() => loadHistory());
  const [showGreeting, setShowGreeting] = useState(false);
  const [showPing, setShowPing] = useState(false);
  const [greetingText, setGreetingText] = useState<string>(() => detectGreeting());
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/kali_master");
  const productCtx = useProductContext(location.pathname);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Broadcast open state to sibling FABs so they hide cleanly.
  useEffect(() => {
    setAiOpen(open);
  }, [open]);

  // Proactive greeting: once per session, after a short delay, if AI still closed.
  const greetTimerRef = useRef<number | null>(null);
  const dismissTimerRef = useRef<number | null>(null);
  const pingTimerRef = useRef<number | null>(null);

  const clearGreetingTimers = () => {
    if (greetTimerRef.current) {
      window.clearTimeout(greetTimerRef.current);
      greetTimerRef.current = null;
    }
    if (dismissTimerRef.current) {
      window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (pingTimerRef.current) {
      window.clearTimeout(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    setGreetingText(detectGreeting());
    greetTimerRef.current = window.setTimeout(() => {
      if (!open) {
        setShowGreeting(true);
        setShowPing(true);
        dismissTimerRef.current = window.setTimeout(() => setShowGreeting(false), 10000);
        pingTimerRef.current = window.setTimeout(() => setShowPing(false), 10000);
      }
    }, GREETING_DELAY_MS);
    return clearGreetingTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dismiss greeting + cancel pending timers when user opens panel.
  useEffect(() => {
    if (open) {
      clearGreetingTimers();
      setShowGreeting(false);
      setShowPing(false);
    }
  }, [open]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/shopping-agent",
        body: () => ({ context: { product: productCtx, path: location.pathname } }),
      }),
    [productCtx, location.pathname],
  );

  const { messages, sendMessage, status, setMessages, error } = useChat({
    id: "arpm-shopping-agent",
    messages: initialMessages,
    transport,
  });

  // Persist last 30
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED)));
    } catch {
      /* ignore quota */
    }
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  // Focus on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  if (!enabled || isAdminRoute) return null;

  const busy = status === "submitted" || status === "streaming";

  const handleSend = (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    sendMessage({ text: content });
  };

  const handleClear = () => {
    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const renderText = (m: UIMessage) =>
    m.parts.map((p, i) => (p.type === "text" ? <span key={i}>{p.text}</span> : null));

  return (
    <>
      {/* Trigger + greeting bubble */}
      {!open && (
        <div className="fixed bottom-6 right-6 z-[21] flex flex-col items-end gap-2">
          {showGreeting && (
            <div
              className="relative max-w-[280px] animate-fade-in rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-medium leading-snug text-slate-800 shadow-xl"
              role="status"
            >
              <button
                type="button"
                onClick={() => {
                  setShowGreeting(false);
                  setShowPing(false);
                }}
                aria-label="Close greeting"
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow hover:text-slate-900"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <span className="pr-2">{greetingText}</span>
              <span className="absolute -bottom-1.5 right-8 h-3 w-3 rotate-45 border-b border-r border-slate-200 bg-white" />
            </div>
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open AI shopping assistant"
            className={cn(
              "group relative inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-primary to-primary/70 px-4 h-12 sm:h-14 text-primary-foreground shadow-2xl shadow-primary/30 ring-1 ring-primary/40 backdrop-blur transition-all hover:scale-[1.03] active:scale-[0.97]",
              showPing && "ring-2 ring-destructive/40",
            )}
          >
            <span className="relative flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center">
              <span
                className={cn(
                  "absolute inset-0 rounded-full bg-primary-foreground/30",
                  (showPing || !showGreeting) && "animate-ping",
                )}
              />
              <Sparkles className="relative h-4 w-4 sm:h-5 sm:w-5" />
            </span>
            <span className="text-sm font-semibold">Ask AI</span>
            {showPing && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive ring-2 ring-card" />
              </span>
            )}
          </button>
        </div>
      )}

      {/* Panel */}
      {open && (
        <div
          style={{ bottom: 8 }}
          className="fixed inset-x-2 z-[80] flex max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-primary/20 bg-card text-card-foreground shadow-2xl shadow-primary/20 backdrop-blur-xl animate-slide-in-right sm:inset-x-auto sm:right-6 sm:w-[400px]"
          role="dialog"
          aria-label="AI Shopping Assistant"
        >
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-primary/15 bg-gradient-to-r from-primary/10 to-transparent px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-md shadow-primary/30">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">AR Prime AI</p>
              <p className="truncate text-[10px] text-muted-foreground">
                Shopping Assistant · USD · Free worldwide shipping
              </p>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear chat"
                className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Context bar */}
          {productCtx && (
            <div className="flex items-center gap-2 border-b border-primary/10 bg-primary/5 px-4 py-2 text-[11px]">
              <ShoppingBag className="h-3 w-3 shrink-0 text-primary" />
              <span className="truncate text-muted-foreground">
                Viewing: <span className="font-medium text-foreground">{productCtx.title}</span>
              </span>
            </div>
          )}

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto p-4 [background-image:radial-gradient(circle_at_1px_1px,hsl(var(--primary)/0.06)_1px,transparent_0)] [background-size:22px_22px]"
          >
            {messages.length === 0 && (
              <div className="space-y-3 py-2">
                <p className="text-sm text-foreground">
                  👋 Hi! I'm <span className="font-semibold">AR Prime AI</span>. Ask me to find
                  products, compare picks, or check shipping to your country.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSend(s)}
                      className="rounded-full border border-primary/20 bg-secondary/60 px-3 py-1.5 text-[11px] font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/10"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => {
              const isUser = m.role === "user";
              if (isUser) {
                return (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground shadow-md shadow-primary/20">
                      {renderText(m)}
                    </div>
                  </div>
                );
              }
              return (
                <div key={m.id} className="flex justify-start">
                  <div className="max-w-[88%] space-y-1 text-sm text-foreground">
                    <div
                      className={cn(
                        "prose prose-sm max-w-none dark:prose-invert",
                        "[&_p]:my-1 [&_ul]:my-1 [&_a]:text-primary [&_a]:font-medium [&_a]:underline-offset-2 hover:[&_a]:underline",
                      )}
                    >
                      {m.parts.map((part, i) => {
                        if (part.type === "text")
                          return <ReactMarkdown key={i}>{part.text}</ReactMarkdown>;
                        if (part.type.startsWith("tool-")) {
                          return (
                            <div
                              key={i}
                              className="my-1 inline-flex items-center gap-1 rounded-full border border-primary/15 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary"
                            >
                              <Loader2
                                className={cn(
                                  "h-2.5 w-2.5",
                                  "state" in part && part.state === "output-available"
                                    ? ""
                                    : "animate-spin",
                                )}
                              />
                              Searching catalog…
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            {status === "submitted" && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-primary/15 bg-secondary/70 px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Thinking…
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                Something went wrong. Please try again.
              </div>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="border-t border-primary/15 bg-background/80 p-3 backdrop-blur"
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  productCtx
                    ? `Ask about ${productCtx.title.slice(0, 32)}…`
                    : "Ask for product recs, shipping, anything…"
                }
                rows={1}
                className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-primary/20 bg-background/80 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                disabled={busy}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || busy}
                className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-md shadow-primary/30"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
              <a
                href={`https://wa.me/8801910521565?text=${encodeURIComponent("Hello AR Prime Market, I need quick help.")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 font-medium text-primary hover:bg-primary/15"
              >
                <MessageCircle className="h-3 w-3" /> WhatsApp
              </a>
              <span className="hidden sm:inline">USD · Worldwide</span>
              <Link
                to="/raiyan-ai"
                className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
              >
                Full Raiyan AI <ExternalLink className="h-2.5 w-2.5" />
              </Link>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export default AiShoppingAgent;
