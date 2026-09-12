import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useLanguage, type LangCode } from "@/context/LanguageContext";

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  rate: number;
}

// Rates are "units of this currency per 1 USD" (USD is the pivot).
// USD is used as the pivot — not BDT — because: (a) it's the standard
// convention for FX rate tables and APIs, (b) the CJ Dropshipping import
// pipeline (the main product source) already prices in USD, and (c) this
// lets the admin panel price a product in ANY currency and have it
// correctly convert to every customer's display currency, rather than
// assuming every price was entered in BDT.
const defaultCurrencies: CurrencyConfig[] = [
  { code: "USD", symbol: "$", name: "US Dollar", rate: 1 },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", rate: 3.6725 },
  { code: "SAR", symbol: "﷼", name: "Saudi Riyal", rate: 3.75 },
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka", rate: 120.5 },
  { code: "INR", symbol: "₹", name: "Indian Rupee", rate: 84.3 },
  { code: "EUR", symbol: "€", name: "Euro", rate: 0.928 },
  { code: "GBP", symbol: "£", name: "British Pound", rate: 0.795 },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", rate: 149.4 },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", rate: 7.23 },
  { code: "KRW", symbol: "₩", name: "South Korean Won", rate: 1325.0 },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", rate: 1.325 },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", rate: 1.566 },
  { code: "TRY", symbol: "₺", name: "Turkish Lira", rate: 32.53 },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", rate: 5.783 },
  { code: "PKR", symbol: "₨", name: "Pakistani Rupee", rate: 279.5 },
  { code: "RUB", symbol: "₽", name: "Russian Ruble", rate: 91.57 },
];

const langToCurrency: Record<LangCode, string> = {
  ar: "AED",
  sa: "SAR",
  en: "USD",
  bn: "BDT",
  hi: "INR",
  es: "EUR",
  fr: "EUR",
  de: "EUR",
  zh: "CNY",
  ja: "JPY",
  pt: "BRL",
  ko: "KRW",
  ru: "RUB",
  tr: "TRY",
  th: "BDT",
  vi: "BDT",
  id: "BDT",
  ms: "BDT",
  sw: "BDT",
  tl: "BDT",
  ur: "PKR",
  fa: "AED",
  it: "EUR",
  nl: "EUR",
  pl: "EUR",
  uk: "BDT",
  ro: "EUR",
  sv: "EUR",
  da: "EUR",
  no: "EUR",
  fi: "EUR",
  el: "EUR",
  hu: "EUR",
  cs: "EUR",
  he: "USD",
};

interface CurrencyContextType {
  currency: CurrencyConfig;
  currencies: CurrencyConfig[];
  setCurrencyByCode: (code: string) => void;
  formatPrice: (price: number, fromCurrency?: string) => string;
  convertPrice: (price: number, fromCurrency?: string) => number;
  /**
   * Formats `amount` using `inCurrency`'s own symbol, WITHOUT converting it
   * to the customer's currently-selected display currency. Use this for
   * financial records that must never change after the fact — an order
   * receipt for a $45 USD charge must always show "$45.00", even if the
   * customer later switches their browsing currency to BDT. `formatPrice`
   * (which DOES live-convert) is for browsing/shopping contexts where
   * showing today's converted price is the correct behavior; this is for
   * "what did I actually pay" contexts where it is not.
   */
  formatInCurrency: (amount: number, inCurrency: string) => string;
  ratesSource: "live" | "fallback" | "loading";
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const STORAGE_KEY = "ar-pm-currency";
const RATES_CACHE_KEY = "ar-pm-rates";
const RATES_TTL = 60 * 60 * 1000;

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const { lang } = useLanguage();

  const [currencies, setCurrencies] = useState<CurrencyConfig[]>(() => {
    if (typeof window === "undefined") return defaultCurrencies;
    try {
      const cached = localStorage.getItem(RATES_CACHE_KEY);
      if (cached) {
        const { rates, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < RATES_TTL) {
          return defaultCurrencies.map((c) => ({ ...c, rate: rates[c.code] ?? c.rate }));
        }
      }
    } catch {}
    return defaultCurrencies;
  });

  const [ratesSource, setRatesSource] = useState<"live" | "fallback" | "loading">("loading");
  const fetchedRef = useRef(false);
  const manuallySetRef = useRef(false);

  const defaultCurrency = currencies.find((c) => c.code === "USD") || currencies[0];
  const [currency, setCurrency] = useState<CurrencyConfig>(() => {
    if (typeof window === "undefined") return defaultCurrency;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const found = currencies.find((c) => c.code === saved);
      if (found) return found;
    }
    return defaultCurrency;
  });

  useEffect(() => {
    if (manuallySetRef.current) return;
    const targetCode = langToCurrency[lang.code];
    if (targetCode) {
      const found = currencies.find((c) => c.code === targetCode);
      if (found) {
        setCurrency(found);
        if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, targetCode);
      }
    }
  }, [lang.code, currencies]);

  useEffect(() => {
    if (fetchedRef.current || typeof window === "undefined") return;
    fetchedRef.current = true;

    const fetchRates = async () => {
      try {
        const res = await fetch("https://open.er-api.com/v6/latest/USD", {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) throw new Error("Rate API error");
        const json = await res.json();
        if (json.result !== "success" || !json.rates) throw new Error("Invalid rate data");

        const rates = json.rates as Record<string, number>;
        const updated = defaultCurrencies.map((c) => ({ ...c, rate: rates[c.code] ?? c.rate }));
        setCurrencies(updated);
        setRatesSource("live");

        setCurrency((prev) => {
          const found = updated.find((c) => c.code === prev.code);
          return found || prev;
        });

        localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({ rates, timestamp: Date.now() }));
      } catch {
        setRatesSource("fallback");
      }
    };

    fetchRates();
  }, []);

  // Auto-pick currency from geo on first visit (no manual or saved preference).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    if (manuallySetRef.current) return;
    import("@/integrations/supabase/client")
      .then(({ supabase }) => {
        supabase.functions
          .invoke("get-user-geo", { method: "GET" })
          .then(({ data, error }) => {
            if (error || !data?.currency || manuallySetRef.current) return;
            if (localStorage.getItem(STORAGE_KEY)) return;
            const found = currencies.find((c) => c.code === data.currency);
            if (found) setCurrency(found);
          })
          .catch(() => {});
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCurrencyByCode = useCallback(
    (code: string) => {
      const found = currencies.find((c) => c.code === code);
      if (found) {
        manuallySetRef.current = true;
        setCurrency(found);
        if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, code);
      }
    },
    [currencies],
  );

  /**
   * Converts `price` (denominated in `fromCurrency`, default "USD" — the
   * currency the CJ Dropshipping import pipeline and the admin product
   * form both actually use) into the customer's currently selected
   * display currency, using live (or cached-fallback) USD-pivot rates.
   */
  const convertPrice = useCallback(
    (price: number, fromCurrency: string = "USD") => {
      const sourceRate =
        currencies.find((c) => c.code === fromCurrency)?.rate ??
        defaultCurrencies.find((c) => c.code === fromCurrency)?.rate ??
        1;
      const priceInUsd = price / sourceRate;
      return Math.round(priceInUsd * currency.rate * 100) / 100;
    },
    [currency, currencies],
  );

  const formatPrice = useCallback(
    (price: number, fromCurrency: string = "USD") => {
      let converted = convertPrice(price, fromCurrency);
      if (currency.code === "BDT") {
        converted = Math.floor(converted);
      }
      return `${currency.symbol}${converted.toLocaleString(undefined, { minimumFractionDigits: currency.code === "BDT" ? 0 : 2, maximumFractionDigits: currency.code === "BDT" ? 0 : 2 })}`;
    },
    [currency, convertPrice],
  );

  const formatInCurrency = useCallback(
    (amount: number, inCurrency: string) => {
      const cfg =
        currencies.find((c) => c.code === inCurrency) ??
        defaultCurrencies.find((c) => c.code === inCurrency);
      const symbol = cfg?.symbol ?? inCurrency + " ";
      const display = inCurrency === "BDT" ? Math.floor(amount) : amount;
      return `${symbol}${display.toLocaleString(undefined, { minimumFractionDigits: inCurrency === "BDT" ? 0 : 2, maximumFractionDigits: inCurrency === "BDT" ? 0 : 2 })}`;
    },
    [currencies],
  );

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        currencies,
        setCurrencyByCode,
        formatPrice,
        convertPrice,
        formatInCurrency,
        ratesSource,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
};
