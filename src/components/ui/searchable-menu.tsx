import { useMemo, type ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useListKeyboardNav } from "@/hooks/useListKeyboardNav";

interface Props<T> {
  query: string;
  setQuery: (v: string) => void;
  placeholder?: string;
  items: ReadonlyArray<T>;
  filter: (item: T, q: string) => boolean;
  onPick: (item: T) => void;
  onClose: () => void;
  renderItem: (item: T, query: string) => ReactNode;
  isSelected: (item: T) => boolean;
  getKey: (item: T) => string;
  className?: string;
}

export function SearchableMenu<T>({
  query,
  setQuery,
  placeholder,
  items,
  filter,
  onPick,
  onClose,
  renderItem,
  isSelected,
  getKey,
  className,
}: Props<T>) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => filter(i, q));
  }, [query, items, filter]);

  const { activeIndex, setActiveIndex, onKeyDown } = useListKeyboardNav(filtered as T[], {
    enabled: true,
    onSelect: onPick,
    onEscape: onClose,
  });

  return (
    <div
      className={cn(
        "absolute right-0 top-full mt-1 w-56 rounded-xl border border-border bg-popover shadow-xl z-50 overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Search className="w-3.5 h-3.5 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? "Search"}
          className="flex-1 bg-transparent text-xs focus:outline-none"
        />
      </div>
      <ul className="max-h-64 overflow-y-auto py-1">
        {filtered.length === 0 && (
          <li className="px-3 py-4 text-xs text-muted-foreground text-center">No matches</li>
        )}
        {filtered.map((item, idx) => {
          const active = idx === activeIndex;
          const selected = isSelected(item);
          return (
            <li key={getKey(item)}>
              <button
                type="button"
                data-active-item={active ? "true" : undefined}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => onPick(item)}
                className={cn(
                  "w-full flex items-center gap-1 px-3 py-2 text-xs text-left transition-colors",
                  active && "bg-accent",
                  selected && "text-primary font-medium",
                )}
              >
                {renderItem(item, query)}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
