import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, X, Loader2, Clock, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/context/CurrencyContext";

type Hit = {
  id: string;
  slug: string;
  title: string;
  price: number;
  currency: string;
  gallery_urls: string[] | null;
};

const STORAGE_KEY = "arp_recent_searches";

function getRecent(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function saveRecent(term: string) {
  const trimmed = term.trim();
  if (!trimmed || trimmed.length < 2) return;
  const prev = getRecent();
  const next = [trimmed, ...prev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(
    0,
    5,
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function removeRecent(term: string) {
  const prev = getRecent();
  const next = prev.filter((s) => s.toLowerCase() !== term.toLowerCase());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function clearRecent() {
  localStorage.removeItem(STORAGE_KEY);
}

function useDebounced<T>(value: T, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export const AdvancedSearch = ({ className = "" }: { className?: string }) => {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const debounced = useDebounced(q, 250);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();

  useEffect(() => {
    setMounted(true);
    setRecents(getRecent());
  }, []);

  const { data: hits = [], isFetching } = useQuery({
    queryKey: ["adv-search", debounced],
    queryFn: async (): Promise<Hit[]> => {
      const term = debounced.trim();
      if (term.length < 2) return [];
      const safe = term.replace(/[%,]/g, " ");
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, title, price, currency, gallery_urls")
        .or(`title.ilike.%${safe}%,sku.ilike.%${safe}%`)
        .eq("is_active", true)
        .limit(8);
      if (error) return [];
      return (data ?? []) as Hit[];
    },
    enabled: debounced.trim().length >= 2,
    staleTime: 30_000,
  });

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => setActive(0), [debounced]);

  const go = (slug: string) => {
    setOpen(false);
    setQ("");
    navigate({ to: "/products/$slug", params: { slug } });
  };

  const submit = () => {
    const term = q.trim();
    if (!term) return;
    saveRecent(term);
    setRecents(getRecent());
    setOpen(false);
    navigate({ to: "/products", search: { q: term, page: 1, sort: "newest" as const } });
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const total = debounced.trim().length >= 2 ? hits.length : recents.length;
      setActive((a) => Math.min(a + 1, total));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const isSearchMode = debounced.trim().length >= 2;
      if (isSearchMode) {
        if (active > 0 && hits[active - 1]) go(hits[active - 1].slug);
        else submit();
      } else {
        if (active > 0 && recents[active - 1]) {
          setQ(recents[active - 1]);
          saveRecent(recents[active - 1]);
          setRecents(getRecent());
          navigate({
            to: "/products",
            search: { q: recents[active - 1], page: 1, sort: "newest" as const },
          });
          setOpen(false);
        } else submit();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const handleRecentClick = (term: string) => {
    setQ(term);
    saveRecent(term);
    setRecents(getRecent());
    navigate({ to: "/products", search: { q: term, page: 1, sort: "newest" as const } });
    setOpen(false);
  };

  const handleRemoveRecent = (e: React.MouseEvent, term: string) => {
    e.stopPropagation();
    removeRecent(term);
    setRecents(getRecent());
  };

  const handleClearRecents = () => {
    clearRecent();
    setRecents([]);
  };

  const showRecents = mounted && open && debounced.trim().length < 2 && recents.length > 0;
  const showHits = open && debounced.trim().length >= 2;

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-secondary/40 focus-within:border-primary focus-within:bg-background transition-colors">
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder="Search products..."
          className="bg-transparent outline-none text-xs w-full placeholder:text-muted-foreground"
          aria-label="Search products"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setOpen(false);
            }}
            aria-label="Clear"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {isFetching && <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />}
      </div>

      {showRecents && (
        <div className="absolute left-0 right-0 top-full mt-2 rounded-xl border border-border bg-popover shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Recent Searches
            </span>
            <button
              type="button"
              onClick={handleClearRecents}
              className="text-[11px] text-destructive hover:text-destructive/80 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Clear all
            </button>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {recents.map((term, idx) => {
              const isActive = active === idx + 1;
              return (
                <li key={term}>
                  <button
                    type="button"
                    onClick={() => handleRecentClick(term)}
                    onMouseEnter={() => setActive(idx + 1)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-xs transition-colors text-left ${isActive ? "bg-secondary" : "hover:bg-secondary/60"}`}
                  >
                    <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate text-foreground">{term}</span>
                    <span
                      onClick={(e) => handleRemoveRecent(e, term)}
                      className="text-muted-foreground hover:text-destructive shrink-0 p-0.5 rounded transition-colors"
                      role="button"
                      aria-label="Remove"
                    >
                      <X className="w-3 h-3" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {showHits && (
        <div className="absolute left-0 right-0 top-full mt-2 rounded-xl border border-border bg-popover shadow-xl z-50 overflow-hidden">
          {hits.length === 0 && !isFetching && (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              কোনো পণ্য পাওয়া যায়নি
            </div>
          )}
          {hits.length > 0 && (
            <ul className="max-h-80 overflow-y-auto py-1">
              {hits.map((h, idx) => {
                const img = h.gallery_urls?.[0] || "/placeholder.svg";
                const isActive = active === idx + 1;
                return (
                  <li key={h.id}>
                    <Link
                      to="/products/$slug"
                      params={{ slug: h.slug }}
                      onClick={() => {
                        setOpen(false);
                        setQ("");
                        saveRecent(q);
                        setRecents(getRecent());
                      }}
                      onMouseEnter={() => setActive(idx + 1)}
                      className={`flex items-center gap-3 px-3 py-2 text-xs transition-colors ${isActive ? "bg-secondary" : "hover:bg-secondary/60"}`}
                    >
                      <img
                        src={img}
                        alt={h.title}
                        className="w-10 h-10 rounded-md object-cover bg-muted shrink-0"
                        loading="lazy"
                      />
                      <span className="flex-1 truncate text-foreground">{h.title}</span>
                      <span className="font-semibold text-primary shrink-0">
                        {formatPrice(h.price, h.currency)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <button
            type="button"
            onClick={submit}
            className={`w-full px-4 py-2.5 text-xs font-medium border-t border-border transition-colors ${active === 0 || active > hits.length ? "bg-secondary text-foreground" : "hover:bg-secondary/60 text-muted-foreground"}`}
          >
            "{q}" এর সব result দেখুন →
          </button>
        </div>
      )}
    </div>
  );
};
