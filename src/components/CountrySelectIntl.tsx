import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { highlightMatch } from "@/lib/highlight";
import { useListKeyboardNav } from "@/hooks/useListKeyboardNav";
import { COUNTRIES, type Country } from "@/components/PhoneInputIntl";

interface Props {
  value: string; // ISO code
  onChange: (iso: string, country: Country) => void;
  className?: string;
}

export function CountrySelectIntl({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const country = useMemo(() => COUNTRIES.find((c) => c.iso === value) || COUNTRIES[0], [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return COUNTRIES;
    const q = query.trim().toLowerCase();
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.iso.toLowerCase().includes(q),
    );
  }, [query]);

  const pick = (c: Country) => {
    onChange(c.iso, c);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-xl border border-border bg-background/60 backdrop-blur-sm px-2.5 sm:px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
        aria-label="Select country"
      >
        <span
          className={cn(
            "fi",
            `fi-${country.iso.toLowerCase()}`,
            "rounded-sm shadow-sm shrink-0 transition-transform duration-200",
          )}
          style={{ width: "1.25rem", height: "0.9rem" }}
          aria-hidden="true"
        />
        <span className="flex-1 text-left truncate min-w-0">{country.name}</span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 shrink-0",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ListPopover
          query={query}
          setQuery={setQuery}
          filtered={filtered}
          selectedIso={country.iso}
          onPick={pick}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function ListPopover({
  query,
  setQuery,
  filtered,
  selectedIso,
  onPick,
  onClose,
}: {
  query: string;
  setQuery: (v: string) => void;
  filtered: Country[];
  selectedIso: string;
  onPick: (c: Country) => void;
  onClose: () => void;
}) {
  const { activeIndex, setActiveIndex, onKeyDown } = useListKeyboardNav(filtered, {
    enabled: true,
    onSelect: onPick,
    onEscape: onClose,
  });
  return (
    <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Search className="w-3.5 h-3.5 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search country or code"
          className="flex-1 bg-transparent text-sm focus:outline-none"
        />
      </div>
      <ul className="max-h-64 overflow-y-auto py-1">
        {filtered.length === 0 && (
          <li className="px-3 py-4 text-xs text-muted-foreground text-center">No matches</li>
        )}
        {filtered.map((c, idx) => {
          const isActive = idx === activeIndex;
          return (
            <li key={c.iso}>
              <button
                type="button"
                data-active-item={isActive ? "true" : undefined}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => onPick(c)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
                  isActive && "bg-accent",
                  c.iso === selectedIso && "font-medium",
                )}
              >
                <span
                  className={cn("fi", `fi-${c.iso.toLowerCase()}`, "rounded-sm shadow-sm shrink-0")}
                  style={{ width: "1.25rem", height: "0.9rem" }}
                  aria-hidden="true"
                />
                <span className="flex-1 truncate">{highlightMatch(c.name, query)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
