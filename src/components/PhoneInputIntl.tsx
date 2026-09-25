import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { highlightMatch } from "@/lib/highlight";
import { useListKeyboardNav } from "@/hooks/useListKeyboardNav";

export type Country = { iso: string; name: string; dial: string; flag: string };

// Curated list — covers primary dropshipping markets + popular regions.
export const COUNTRIES: Country[] = [
  { iso: "US", name: "United States", dial: "+1", flag: "🇺🇸" },
  { iso: "CA", name: "Canada", dial: "+1", flag: "🇨🇦" },
  { iso: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { iso: "AU", name: "Australia", dial: "+61", flag: "🇦🇺" },
  { iso: "AE", name: "United Arab Emirates", dial: "+971", flag: "🇦🇪" },
  { iso: "SA", name: "Saudi Arabia", dial: "+966", flag: "🇸🇦" },
  { iso: "DE", name: "Germany", dial: "+49", flag: "🇩🇪" },
  { iso: "FR", name: "France", dial: "+33", flag: "🇫🇷" },
  { iso: "IT", name: "Italy", dial: "+39", flag: "🇮🇹" },
  { iso: "ES", name: "Spain", dial: "+34", flag: "🇪🇸" },
  { iso: "NL", name: "Netherlands", dial: "+31", flag: "🇳🇱" },
  { iso: "SE", name: "Sweden", dial: "+46", flag: "🇸🇪" },
  { iso: "NO", name: "Norway", dial: "+47", flag: "🇳🇴" },
  { iso: "DK", name: "Denmark", dial: "+45", flag: "🇩🇰" },
  { iso: "IE", name: "Ireland", dial: "+353", flag: "🇮🇪" },
  { iso: "CH", name: "Switzerland", dial: "+41", flag: "🇨🇭" },
  { iso: "BE", name: "Belgium", dial: "+32", flag: "🇧🇪" },
  { iso: "AT", name: "Austria", dial: "+43", flag: "🇦🇹" },
  { iso: "PT", name: "Portugal", dial: "+351", flag: "🇵🇹" },
  { iso: "PL", name: "Poland", dial: "+48", flag: "🇵🇱" },
  { iso: "NZ", name: "New Zealand", dial: "+64", flag: "🇳🇿" },
  { iso: "SG", name: "Singapore", dial: "+65", flag: "🇸🇬" },
  { iso: "MY", name: "Malaysia", dial: "+60", flag: "🇲🇾" },
  { iso: "JP", name: "Japan", dial: "+81", flag: "🇯🇵" },
  { iso: "KR", name: "South Korea", dial: "+82", flag: "🇰🇷" },
  { iso: "HK", name: "Hong Kong", dial: "+852", flag: "🇭🇰" },
  { iso: "IN", name: "India", dial: "+91", flag: "🇮🇳" },
  { iso: "PK", name: "Pakistan", dial: "+92", flag: "🇵🇰" },
  { iso: "BD", name: "Bangladesh", dial: "+880", flag: "🇧🇩" },
  { iso: "ID", name: "Indonesia", dial: "+62", flag: "🇮🇩" },
  { iso: "PH", name: "Philippines", dial: "+63", flag: "🇵🇭" },
  { iso: "TH", name: "Thailand", dial: "+66", flag: "🇹🇭" },
  { iso: "VN", name: "Vietnam", dial: "+84", flag: "🇻🇳" },
  { iso: "TR", name: "Türkiye", dial: "+90", flag: "🇹🇷" },
  { iso: "EG", name: "Egypt", dial: "+20", flag: "🇪🇬" },
  { iso: "ZA", name: "South Africa", dial: "+27", flag: "🇿🇦" },
  { iso: "NG", name: "Nigeria", dial: "+234", flag: "🇳🇬" },
  { iso: "KE", name: "Kenya", dial: "+254", flag: "🇰🇪" },
  { iso: "BR", name: "Brazil", dial: "+55", flag: "🇧🇷" },
  { iso: "MX", name: "Mexico", dial: "+52", flag: "🇲🇽" },
  { iso: "AR", name: "Argentina", dial: "+54", flag: "🇦🇷" },
  { iso: "QA", name: "Qatar", dial: "+974", flag: "🇶🇦" },
  { iso: "KW", name: "Kuwait", dial: "+965", flag: "🇰🇼" },
  { iso: "BH", name: "Bahrain", dial: "+973", flag: "🇧🇭" },
  { iso: "OM", name: "Oman", dial: "+968", flag: "🇴🇲" },
];

// Per-country national-number formats: example placeholder + max national digits.
export const COUNTRY_FORMATS: Record<string, { example: string; maxDigits: number }> = {
  US: { example: "(555) 123-4567", maxDigits: 10 },
  CA: { example: "(416) 555-0123", maxDigits: 10 },
  GB: { example: "07700 900123", maxDigits: 10 },
  AU: { example: "0412 345 678", maxDigits: 9 },
  AE: { example: "50 123 4567", maxDigits: 9 },
  SA: { example: "50 123 4567", maxDigits: 9 },
  DE: { example: "030 12345678", maxDigits: 11 },
  FR: { example: "06 12 34 56 78", maxDigits: 9 },
  IT: { example: "312 345 6789", maxDigits: 10 },
  ES: { example: "612 34 56 78", maxDigits: 9 },
  NL: { example: "06 12345678", maxDigits: 9 },
  SE: { example: "070 123 45 67", maxDigits: 9 },
  NO: { example: "406 12 345", maxDigits: 8 },
  DK: { example: "32 12 34 56", maxDigits: 8 },
  IE: { example: "085 012 3456", maxDigits: 9 },
  CH: { example: "078 123 45 67", maxDigits: 9 },
  BE: { example: "0470 12 34 56", maxDigits: 9 },
  AT: { example: "0664 1234567", maxDigits: 11 },
  PT: { example: "912 345 678", maxDigits: 9 },
  PL: { example: "512 345 678", maxDigits: 9 },
  NZ: { example: "021 123 4567", maxDigits: 9 },
  SG: { example: "8123 4567", maxDigits: 8 },
  MY: { example: "012-345 6789", maxDigits: 10 },
  JP: { example: "090-1234-5678", maxDigits: 10 },
  KR: { example: "010-1234-5678", maxDigits: 10 },
  HK: { example: "5123 4567", maxDigits: 8 },
  IN: { example: "98765 43210", maxDigits: 10 },
  PK: { example: "0301 2345678", maxDigits: 10 },
  BD: { example: "01712 345678", maxDigits: 10 },
  ID: { example: "0812 3456 7890", maxDigits: 11 },
  PH: { example: "0917 123 4567", maxDigits: 10 },
  TH: { example: "081 234 5678", maxDigits: 9 },
  VN: { example: "091 234 56 78", maxDigits: 9 },
  TR: { example: "0532 123 45 67", maxDigits: 10 },
  EG: { example: "0100 123 4567", maxDigits: 10 },
  ZA: { example: "071 123 4567", maxDigits: 9 },
  NG: { example: "0803 123 4567", maxDigits: 10 },
  KE: { example: "0712 345678", maxDigits: 9 },
  BR: { example: "(11) 91234-5678", maxDigits: 11 },
  MX: { example: "55 1234 5678", maxDigits: 10 },
  AR: { example: "011 1234-5678", maxDigits: 10 },
  QA: { example: "3312 3456", maxDigits: 8 },
  KW: { example: "500 12345", maxDigits: 8 },
  BH: { example: "3600 1234", maxDigits: 8 },
  OM: { example: "9212 3456", maxDigits: 8 },
};

const DEFAULT_FORMAT = { example: "555 123 4567", maxDigits: 15 };
export function getCountryFormat(iso: string) {
  return COUNTRY_FORMATS[iso] ?? DEFAULT_FORMAT;
}

const DEFAULT_ISO = "US";

function detectInitialCountry(): Country {
  if (typeof navigator === "undefined") return COUNTRIES[0];
  // 1. navigator.language → region (e.g. "en-AE")
  const langs = [navigator.language, ...(navigator.languages ?? [])];
  for (const l of langs) {
    const m = /-([A-Z]{2})$/i.exec(l ?? "");
    if (m) {
      const iso = m[1].toUpperCase();
      const c = COUNTRIES.find((x) => x.iso === iso);
      if (c) return c;
    }
  }
  // 2. Timezone hint
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const tzMap: Record<string, string> = {
      "Asia/Dubai": "AE",
      "Asia/Riyadh": "SA",
      "Asia/Qatar": "QA",
      "Asia/Kuwait": "KW",
      "Asia/Bahrain": "BH",
      "Asia/Muscat": "OM",
      "Europe/London": "GB",
      "Europe/Dublin": "IE",
      "Europe/Paris": "FR",
      "Europe/Berlin": "DE",
      "Europe/Madrid": "ES",
      "Europe/Rome": "IT",
      "Europe/Amsterdam": "NL",
      "Australia/Sydney": "AU",
      "Pacific/Auckland": "NZ",
      "Asia/Dhaka": "BD",
      "Asia/Karachi": "PK",
      "Asia/Kolkata": "IN",
      "Asia/Singapore": "SG",
      "Asia/Hong_Kong": "HK",
      "Asia/Tokyo": "JP",
    };
    if (tzMap[tz]) {
      const c = COUNTRIES.find((x) => x.iso === tzMap[tz]);
      if (c) return c;
    }
    if (tz.startsWith("America/")) return COUNTRIES.find((c) => c.iso === "US")!;
  } catch {
    /* ignore */
  }
  return COUNTRIES.find((c) => c.iso === DEFAULT_ISO) ?? COUNTRIES[0];
}

interface Props {
  value: string;
  onChange: (fullPhone: string) => void;
  onFirstInput?: () => void;
  required?: boolean;
  className?: string;
  inputClassName?: string;
}

// Strip any leading "+<digits>" (with or without space) from a string.
// Handles E.164 ("+15551234567"), display ("+1 555 1234567"), and repeated prefixes.
function stripDial(input: string): string {
  let s = input.trimStart();
  while (/^\+\d{1,4}\s*/.test(s)) {
    s = s.replace(/^\+\d{1,4}\s*/, "");
  }
  return s;
}

export function PhoneInputIntl({
  value,
  onChange,
  onFirstInput,
  required,
  className,
  inputClassName,
}: Props) {
  const [country, setCountry] = useState<Country>(() => COUNTRIES[0]);
  const [national, setNational] = useState<string>(() => stripDial(value ?? ""));
  const [hydrated, setHydrated] = useState(false);
  const [userPicked, setUserPicked] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const firedFirstRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Detect after mount (browser only).
  useEffect(() => {
    setCountry(detectInitialCountry());
    setHydrated(true);
  }, []);

  // Optional geo refinement via Supabase edge fn — only if user hasn't manually picked.
  useEffect(() => {
    if (!hydrated || userPicked) return;
    let cancelled = false;
    import("@/integrations/supabase/client")
      .then(({ supabase }) => {
        supabase.functions
          .invoke("get-user-geo", { method: "GET" })
          .then(({ data, error }) => {
            if (cancelled || error || !data?.country || userPicked) return;
            const iso = String(data.country).toUpperCase();
            const match = COUNTRIES.find((c) => c.iso === iso);
            if (match) setCountry(match);
          })
          .catch(() => {
            /* ignore */
          });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hydrated, userPicked]);

  // National "trunk prefix" handling: most countries (BD, GB, AU, DE...) use a
  // leading 0 when dialing locally that must NOT appear in E.164. Customers often
  // type it anyway — keep it VISIBLE in the input, but strip it from the emitted
  // value. Italy is the known exception where the 0 is part of the number.
  const significantDigits = (digits: string, iso: string) =>
    iso === "IT" ? digits : digits.replace(/^0+/, "");

  // Emit normalized E.164 value (e.g. "+15551234567") whenever country or digits change.
  useEffect(() => {
    const nationalDigits = significantDigits(national.replace(/\D/g, ""), country.iso);
    const dialDigits = country.dial.replace(/\D/g, "");
    const next = nationalDigits ? `+${dialDigits}${nationalDigits}` : "";
    if (next !== value) onChangeRef.current(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country.dial, national]);

  // Sync if parent clears or changes the value externally (e.g. form reset).
  // IMPORTANT: compare digits against dial+national first — never re-strip our own
  // emitted value (greedy "+\d{1,4}" stripping eats the first national digit for
  // 3-digit dial codes like +880, causing typed digits to disappear).
  useEffect(() => {
    const natSignificant = significantDigits(national.replace(/\D/g, ""), country.iso);
    if (!value) {
      // Only treat as an external reset if we actually had significant digits —
      // a lone typed "0" emits "" and must not be wiped from the display.
      if (natSignificant) setNational("");
      return;
    }
    const valueDigits = value.replace(/\D/g, "");
    const dialDigits = country.dial.replace(/\D/g, "");
    if (valueDigits === dialDigits + natSignificant) return; // our own emit echoed back
    // External change: strip the exact dial code of the selected country only.
    const nat = valueDigits.startsWith(dialDigits)
      ? valueDigits.slice(dialDigits.length)
      : valueDigits;
    if (nat !== natSignificant) setNational(nat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

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

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Normalize Bengali (০-৯), Arabic-Indic (٠-٩), Persian (۰-۹), and Devanagari digits to ASCII.
    const normalized = e.target.value
      .replace(/[\u0966-\u096F]/g, (d) => String(d.charCodeAt(0) - 0x0966))
      .replace(/[\u09E6-\u09EF]/g, (d) => String(d.charCodeAt(0) - 0x09e6))
      .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
    const cleaned = stripDial(normalized).replace(/[^\d\s\-()]/g, "");
    const digits = cleaned.replace(/\D/g, "");
    const fmt = getCountryFormat(country.iso);
    // Allow ONE extra char when the customer typed the local leading 0
    // (e.g. BD "01712345678" = 11 chars but only 10 significant digits).
    const allowance = country.iso !== "IT" && digits.startsWith("0") ? 1 : 0;
    const max = fmt.maxDigits + allowance;
    const limited = digits.length > max ? digits.slice(0, max) : digits;
    if (!firedFirstRef.current && limited.length > 0) {
      firedFirstRef.current = true;
      onFirstInput?.();
    }
    setNational(limited);
  };

  const pickCountry = (c: Country) => {
    setUserPicked(true);
    setCountry(c);
    setOpen(false);
    setQuery("");
    // Trim digits to fit the new country's expected length (leading 0 gets one extra slot).
    setNational((prev) => {
      const digits = prev.replace(/\D/g, "");
      const fmt = getCountryFormat(c.iso);
      const max = fmt.maxDigits + (c.iso !== "IT" && digits.startsWith("0") ? 1 : 0);
      if (digits.length <= max) return prev;
      return digits.slice(0, max);
    });
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex items-stretch rounded-xl border border-border bg-background/60 backdrop-blur-sm focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary/50 transition-all",
          inputClassName,
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 pl-3 pr-2 text-sm font-medium text-foreground hover:bg-muted/50 rounded-l-xl transition-colors"
          aria-label="Select country"
        >
          <span
            className={cn("fi", `fi-${country.iso.toLowerCase()}`, "rounded-sm shadow-sm")}
            style={{ width: "1.25rem", height: "0.9rem" }}
            aria-hidden="true"
          />
          <span className="tabular-nums text-sm">{country.dial}</span>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        <div className="w-px self-stretch bg-border my-2" />
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={national}
          onChange={handleNumberChange}
          required={required}
          placeholder={getCountryFormat(country.iso).example}
          className="flex-1 min-w-0 bg-transparent pl-3 pr-3 py-3 text-base sm:text-sm font-medium text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />
      </div>

      {open && (
        <DropdownList
          query={query}
          setQuery={setQuery}
          filtered={filtered}
          country={country}
          onPick={pickCountry}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function DropdownList({
  query,
  setQuery,
  filtered,
  country,
  onPick,
  onClose,
}: {
  query: string;
  setQuery: (v: string) => void;
  filtered: Country[];
  country: Country;
  onPick: (c: Country) => void;
  onClose: () => void;
}) {
  const { activeIndex, setActiveIndex, onKeyDown } = useListKeyboardNav(filtered, {
    enabled: true,
    onSelect: onPick,
    onEscape: onClose,
  });
  return (
    <div className="absolute z-50 mt-1 w-full max-w-xs rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
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
                  c.iso === country.iso && "font-medium",
                )}
              >
                <span
                  className={cn("fi", `fi-${c.iso.toLowerCase()}`, "rounded-sm shadow-sm shrink-0")}
                  style={{ width: "1.25rem", height: "0.9rem" }}
                  aria-hidden="true"
                />
                <span className="flex-1 truncate">{highlightMatch(c.name, query)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {highlightMatch(c.dial, query)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
