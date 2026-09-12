import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { chatWithAgent } from "@/lib/agent-chat.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { ActionConfirmCard, type AgentAction } from "./ActionConfirmCard";
import { TypingDots } from "./TypingDots";
import { QuickSuggestions } from "./QuickSuggestions";
import { toast } from "sonner";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: AgentAction | null;
};

export function ChatPanel() {
  const send = useServerFn(chatWithAgent);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "সালাম! আমি AR Prime Market-এর Marketing Head এজেন্ট। বলুন আজ কী করতে চান — sales report, ad campaign, flash sale, product research — সব handle করব।",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);
    try {
      const history = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));
      const res = (await send({ data: { message: trimmed, history } })) as {
        reply: string;
        action: AgentAction | null;
      };
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: res.reply,
          action: res.action,
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Agent error";
      toast.error(msg);
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "দুঃখিত, একটা সমস্যা হয়েছে: " + msg,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role}>
            {m.content}
            {m.action && <ActionConfirmCard action={m.action} />}
          </MessageBubble>
        ))}
        {busy && (
          <MessageBubble role="assistant">
            <TypingDots />
          </MessageBubble>
        )}
      </div>
      <div className="border-t border-border p-3 space-y-2 bg-background">
        <QuickSuggestions onPick={(s) => submit(s)} disabled={busy} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="এজেন্টকে কিছু বলুন..."
            disabled={busy}
            autoFocus
          />
          <Button type="submit" disabled={busy || !input.trim()} aria-label="Send message">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
