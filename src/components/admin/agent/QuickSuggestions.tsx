const SUGGESTIONS = [
  "আজকের sales দেখাও",
  "Flash sale চালাও",
  "Low stock দেখাও",
  "ROAS report দাও",
  "নতুন product research করো",
];

export function QuickSuggestions({
  onPick,
  disabled,
}: {
  onPick: (s: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 px-1 scrollbar-thin">
      {SUGGESTIONS.map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onPick(s)}
          className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-card hover:bg-accent hover:text-accent-foreground disabled:opacity-50 transition-colors"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
