import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Send,
  Loader2,
  Sparkles,
  Bot,
  User,
  Star,
  ShoppingCart,
  Mic,
  MicOff,
  ImageIcon,
  X,
  Package,
  CheckCircle2,
  Circle,
  Truck,
  Home,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getThreadMessages } from "@/lib/raiyan-ai.functions";
import { useCart } from "@/context/CartContext";
import { ChatScrollToTop } from "@/components/ChatScrollToTop";
import { toast } from "sonner";

export const Route = createFileRoute("/raiyan-ai/$threadId")({
  component: ChatPage,
});

type ProductCard = {
  id: string;
  title: string;
  slug: string;
  price: number;
  compare_at_price: number | null;
  image: string | null;
  rating: number;
  review_count: number;
};

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB

function ChatPage() {
  const { threadId } = Route.useParams();
  const getMsgsFn = useServerFn(getThreadMessages);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-thread", threadId],
    queryFn: () => getMsgsFn({ data: { threadId } }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <ChatWindow key={threadId} threadId={threadId} initial={data?.messages ?? []} />;
}

function ChatWindow({
  threadId,
  initial,
}: {
  threadId: string;
  initial: Array<{ id: string; role: string; parts: unknown }>;
}) {
  const { addToCart } = useCart();
  const initialMessages = useMemo<UIMessage[]>(
    () =>
      initial.map((m) => ({
        id: m.id,
        role: m.role as UIMessage["role"],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parts: (m.parts as any) ?? [],
      })),
    [initial],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: async ({ messages, body }) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          const headers: Record<string, string> = {};
          if (token) headers.Authorization = `Bearer ${token}`;
          return {
            body: { ...(body ?? {}), messages, threadId },
            headers,
          };
        },
      }),
    [threadId],
  );

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
  });

  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<{ dataUrl: string; mediaType: string } | null>(
    null,
  );
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Web Speech API voice input
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const baseInputRef = useRef("");

  useEffect(() => {
    const SR =
      (typeof window !== "undefined" &&
        ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) ||
      null;
    if (!SR) return;
    setVoiceSupported(true);
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "bn-BD";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let transcript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      const base = baseInputRef.current;
      setInput((base ? base + " " : "") + transcript);
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = (e: { error?: string }) => {
      setIsListening(false);
      if (e.error && e.error !== "no-speech" && e.error !== "aborted") {
        toast.error(`Voice ত্রুটি: ${e.error}`);
      }
    };
    recognitionRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    };
  }, []);

  const toggleVoice = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (isListening) {
      rec.stop();
      setIsListening(false);
    } else {
      baseInputRef.current = input.trim();
      try {
        rec.start();
        setIsListening(true);
      } catch {
        /* already started */
      }
    }
  };

  const handleImagePick = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("শুধু image file আপলোড করুন");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("ছবি ২MB এর কম হতে হবে");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPendingImage({ dataUrl: String(reader.result), mediaType: file.type });
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    textRef.current?.focus();
  }, [threadId, status]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const isBusy = status === "submitted" || status === "streaming";

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if ((!text && !pendingImage) || isBusy) return;
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* noop */
      }
      setIsListening(false);
    }

    if (pendingImage) {
      // Multi-part user message with image + optional text
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts: any[] = [
        { type: "file", mediaType: pendingImage.mediaType, url: pendingImage.dataUrl },
      ];
      if (text) parts.push({ type: "text", text });
      else parts.push({ type: "text", text: "এই ছবির মতো পণ্য খুঁজে দাও" });
      sendMessage({ role: "user", parts });
    } else {
      sendMessage({ text });
    }

    setInput("");
    setPendingImage(null);
    baseInputRef.current = "";
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="relative flex flex-col h-[calc(100vh-12rem)] md:h-[calc(100vh-10rem)] rounded-3xl border border-primary/20 bg-gradient-to-br from-background via-background to-primary/5 overflow-hidden shadow-[0_0_40px_-12px_hsl(var(--primary)/0.4)]">
      {/* Header */}
      <div className="relative flex items-center gap-3 px-4 py-3 border-b border-primary/15 bg-background/60 backdrop-blur-xl">
        <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center ring-2 ring-primary/30 shadow-[0_0_15px_-2px_hsl(var(--primary)/0.6)]">
          <Sparkles className="w-4 h-4 text-primary-foreground" />
          <span className="absolute inset-0 rounded-full animate-ping bg-primary/30" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
            Raiyan AI
          </p>
          <p className="text-[11px] text-muted-foreground">
            Vision · Order tracking · Product search
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      </div>

      {/* Scroll area */}
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-4 [background-image:radial-gradient(circle_at_1px_1px,hsl(var(--primary)/0.07)_1px,transparent_0)] [background-size:24px_24px]"
      >
        {messages.length === 0 && (
          <div className="text-center py-10 animate-fade-in">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-3 ring-2 ring-primary/20 shadow-[0_0_25px_-5px_hsl(var(--primary)/0.5)]">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-semibold mb-1 text-base">কী খুঁজছেন?</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              ছবি আপলোড করুন, অথবা লিখুন: "৫০০০ টাকার মধ্যে headphone" বা "ORD-20260516-XXXX track
              করো"
            </p>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            onAddToCart={(p) => {
              addToCart({
                id: p.id,
                title: p.title,
                slug: p.slug,
                description: "",
                price: p.price,
                image: p.image ?? "",
                category: "",
                category_id: null,
                stock_quantity: 1,
                compare_at_price: p.compare_at_price,
                currency: "BDT",
                images: p.image ? [p.image] : [],
                sku: null,
                rating: p.rating,
                review_count: p.review_count,
              });
              toast.success(`${p.title} কার্টে যোগ হয়েছে`);
            }}
          />
        ))}

        {status === "submitted" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground animate-fade-in">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <span className="animate-pulse">Raiyan ভাবছে...</span>
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2">
            ত্রুটি: {error.message}
          </div>
        )}

        <div ref={endRef} />
        <ChatScrollToTop scrollRef={scrollRef} />
      </div>

      {pendingImage && (
        <div className="px-3 pt-2 border-t border-primary/15 bg-background/60 backdrop-blur-xl">
          <div className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-background p-1.5 pr-2 shadow-[0_0_15px_-5px_hsl(var(--primary)/0.4)]">
            <img
              src={pendingImage.dataUrl}
              alt="upload preview"
              className="w-10 h-10 rounded-lg object-cover"
            />
            <span className="text-xs text-muted-foreground">ছবি যোগ করা হয়েছে</span>
            <button
              type="button"
              onClick={() => setPendingImage(null)}
              aria-label="remove image"
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <form
        onSubmit={handleSubmit}
        className="relative border-t border-primary/15 p-3 bg-background/70 backdrop-blur-xl"
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleImagePick(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            aria-label="Upload image"
            title="ছবি দিয়ে product খুঁজুন"
            className="rounded-xl border-primary/30 hover:border-primary/60 hover:bg-primary/10 transition-all"
          >
            <ImageIcon className="w-4 h-4" />
          </Button>

          <textarea
            ref={textRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={
              isListening
                ? "শুনছি... কথা বলুন"
                : pendingImage
                  ? "ছবি বর্ণনা দিন (optional)..."
                  : "Raiyan-কে জিজ্ঞেস করুন..."
            }
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-primary/20 bg-background/80 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary/40 focus:shadow-[0_0_15px_-3px_hsl(var(--primary)/0.5)] transition-all max-h-32 placeholder:text-muted-foreground/70"
          />
          {voiceSupported && (
            <Button
              type="button"
              size="icon"
              variant={isListening ? "default" : "outline"}
              onClick={toggleVoice}
              aria-label={isListening ? "Stop voice input" : "Start voice input"}
              className={`rounded-xl transition-all ${isListening ? "animate-pulse shadow-[0_0_20px_-3px_hsl(var(--primary)/0.7)]" : "border-primary/30 hover:border-primary/60 hover:bg-primary/10"}`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
          )}
          <Button
            type="submit"
            size="icon"
            disabled={isBusy || (!input.trim() && !pendingImage)}
            aria-label="Send"
            className="rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-[0_0_15px_-3px_hsl(var(--primary)/0.5)] hover:shadow-[0_0_25px_-3px_hsl(var(--primary)/0.7)] hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}

type TimelineStep = { key: string; label: string; done: boolean; current: boolean };
type OrderTrack = {
  found: boolean;
  order?: {
    order_number: string;
    status: string;
    payment_status: string | null;
    total: number;
    currency: string;
    placed_at: string;
    cancelled: boolean;
  };
  timeline?: TimelineStep[];
  order_number?: string;
};

function MessageBubble({
  message,
  onAddToCart,
}: {
  message: UIMessage;
  onAddToCart: (p: ProductCard) => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-2 animate-fade-in ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 ring-2 ring-primary/30 shadow-[0_0_12px_-3px_hsl(var(--primary)/0.5)]">
          <Bot className="w-4 h-4 text-primary" />
        </div>
      )}
      <div
        className={`max-w-[85%] space-y-2 ${isUser ? "items-end" : "items-start"} flex flex-col`}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return (
              <div
                key={i}
                className={
                  isUser
                    ? "rounded-2xl rounded-tr-md bg-gradient-to-br from-primary to-primary/80 text-primary-foreground px-4 py-2.5 text-sm whitespace-pre-wrap shadow-[0_0_20px_-5px_hsl(var(--primary)/0.5)] border border-primary/40"
                    : "rounded-2xl rounded-tl-md bg-card/80 backdrop-blur-sm border border-primary/15 px-4 py-2.5 text-sm text-foreground prose prose-sm dark:prose-invert max-w-none shadow-[0_2px_15px_-5px_hsl(var(--primary)/0.2)]"
                }
              >
                {isUser ? part.text : <ReactMarkdown>{part.text}</ReactMarkdown>}
              </div>
            );
          }
          if (part.type === "file") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const url = (part as any).url as string | undefined;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mt = (part as any).mediaType as string | undefined;
            if (url && mt?.startsWith("image/")) {
              return (
                <img
                  key={i}
                  src={url}
                  alt="uploaded"
                  className="max-w-[220px] rounded-xl border border-primary/30 shadow-[0_0_15px_-5px_hsl(var(--primary)/0.4)]"
                />
              );
            }
            return null;
          }
          if (part.type === "tool-search_products") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const state = (part as any).state as string;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const output = (part as any).output as { products?: ProductCard[] } | undefined;
            if (state === "output-available" && output?.products) {
              return <ProductGrid key={i} products={output.products} onAddToCart={onAddToCart} />;
            }
            return (
              <div key={i} className="text-xs text-muted-foreground italic flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Product খোঁজা হচ্ছে...
              </div>
            );
          }
          if (part.type === "tool-track_order") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const state = (part as any).state as string;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const output = (part as any).output as OrderTrack | undefined;
            if (state === "output-available" && output) {
              return <OrderTimeline key={i} data={output} />;
            }
            return (
              <div key={i} className="text-xs text-muted-foreground italic flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Order tracking হচ্ছে...
              </div>
            );
          }
          return null;
        })}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center shrink-0 ring-2 ring-primary/20 shadow-[0_0_10px_-3px_hsl(var(--primary)/0.4)]">
          <User className="w-4 h-4" />
        </div>
      )}
    </div>
  );
}

function OrderTimeline({ data }: { data: OrderTrack }) {
  if (!data.found) {
    return (
      <div className="rounded-xl border border-border bg-card p-3 text-sm w-full max-w-md">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Package className="w-4 h-4" />
          <span>
            Order <strong>{data.order_number}</strong> পাওয়া যায়নি।
          </span>
        </div>
      </div>
    );
  }
  const o = data.order!;
  const tl = data.timeline ?? [];
  const stepIcon = (key: string) => {
    if (key === "shipped") return Truck;
    if (key === "delivered") return Home;
    return Package;
  };
  return (
    <div className="rounded-xl border border-border bg-card p-3 w-full max-w-md space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Order</p>
          <p className="font-semibold text-sm">{o.order_number}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="font-semibold text-sm">৳{o.total.toLocaleString()}</p>
        </div>
      </div>
      {o.cancelled ? (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          <Ban className="w-4 h-4" /> Order {o.status}
        </div>
      ) : (
        <ol className="space-y-2">
          {tl.map((step) => {
            const Icon = stepIcon(step.key);
            return (
              <li key={step.key} className="flex items-center gap-3">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center ${step.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"} ${step.current ? "ring-2 ring-primary/40" : ""}`}
                >
                  {step.done ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Circle className="w-4 h-4" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span
                    className={
                      step.current ? "font-semibold" : step.done ? "" : "text-muted-foreground"
                    }
                  >
                    {step.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <p className="text-[11px] text-muted-foreground">
        Placed {new Date(o.placed_at).toLocaleString()} · Payment: {o.payment_status ?? "unpaid"}
      </p>
    </div>
  );
}

function ProductGrid({
  products,
  onAddToCart,
}: {
  products: ProductCard[];
  onAddToCart: (p: ProductCard) => void;
}) {
  if (!products.length) {
    return <p className="text-xs text-muted-foreground italic">কোনো প্রোডাক্ট পাওয়া যায়নি</p>;
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full">
      {products.map((p) => (
        <div
          key={p.id}
          className="rounded-xl border border-border bg-card overflow-hidden flex flex-col"
        >
          <Link
            to="/products/$slug"
            params={{ slug: p.slug }}
            className="block aspect-square bg-muted"
          >
            {p.image && (
              <img
                src={p.image}
                alt={p.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            )}
          </Link>
          <div className="p-2 flex-1 flex flex-col gap-1">
            <Link
              to="/products/$slug"
              params={{ slug: p.slug }}
              className="text-xs font-medium line-clamp-2 hover:text-primary"
            >
              {p.title}
            </Link>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              {p.rating.toFixed(1)} ({p.review_count})
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-bold">৳{p.price}</span>
              {p.compare_at_price && (
                <span className="text-[10px] text-muted-foreground line-through">
                  ৳{p.compare_at_price}
                </span>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs mt-auto"
              onClick={() => onAddToCart(p)}
            >
              <ShoppingCart className="w-3 h-3 mr-1" /> Cart
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
