import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function MessageBubble({
  role,
  children,
}: {
  role: "user" | "assistant";
  children: ReactNode;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-2 text-sm whitespace-pre-wrap">
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-1 max-w-[85%]">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <Bot className="w-3.5 h-3.5" />
        <span>AR এজেন্ট</span>
      </div>
      <div className={cn("text-sm text-foreground whitespace-pre-wrap leading-relaxed")}>
        {children}
      </div>
    </div>
  );
}
