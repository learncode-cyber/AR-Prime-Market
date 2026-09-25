import { cn } from "@/lib/utils";

interface Props {
  variant?: "powered" | "company" | "ecosystem";
  className?: string;
}

const LABELS: Record<NonNullable<Props["variant"]>, string> = {
  powered: "Powered by AR Qudrix",
  company: "An AR Qudrix Company",
  ecosystem: "Part of AR Qudrix Ecosystem",
};

export function PoweredByQudrix({ variant = "company", className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground",
        className,
      )}
    >
      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-foreground text-background text-[8px] font-bold leading-none">
        Q
      </span>
      {LABELS[variant]}
    </span>
  );
}
