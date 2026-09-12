import { useState } from "react";
import { Sparkles, FileText, Pencil, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatPanel } from "./ChatPanel";
import { HistoryPanel } from "./HistoryPanel";

type Tab = "chat" | "history";

export function AgentChat() {
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex gap-1">
          <TabBtn active={tab === "chat"} onClick={() => setTab("chat")}>
            চ্যাট
          </TabBtn>
          <TabBtn active={tab === "history"} onClick={() => setTab("history")}>
            হিস্টরি
          </TabBtn>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <IconBtn>
            <Sparkles className="w-4 h-4" />
          </IconBtn>
          <IconBtn>
            <FileText className="w-4 h-4" />
          </IconBtn>
          <IconBtn>
            <Pencil className="w-4 h-4" />
          </IconBtn>
          <IconBtn>
            <ArrowRight className="w-4 h-4" />
          </IconBtn>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {tab === "chat" ? (
          <ChatPanel />
        ) : (
          <div className="h-full overflow-y-auto">
            <HistoryPanel />
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function IconBtn({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="p-1.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      {children}
    </button>
  );
}
