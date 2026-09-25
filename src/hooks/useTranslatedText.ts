import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

// In-memory cache to avoid re-fetching during same session
const memoryCache = new Map<string, string>();
const cacheKey = (text: string, lang: string) => `${lang}::${text}`;

/**
 * Translate a single string to the current UI language. Returns the original
 * text immediately, then swaps to the translated value when ready.
 *
 * Lookup order: memory cache → `translations` table → translate-content edge fn.
 * If translations table / edge fn aren't available, the original text is kept.
 */
export function useTranslatedText(text: string | undefined | null): string {
  const { lang } = useLanguage();
  const [translated, setTranslated] = useState(text || "");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!text) {
      setTranslated("");
      return;
    }
    if (lang.code === "en") {
      setTranslated(text);
      return;
    }

    const key = cacheKey(text, lang.code);
    const cached = memoryCache.get(key);
    if (cached) {
      setTranslated(cached);
      return;
    }

    setTranslated(text); // show original while loading

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const { data } = await supabase
          .from("translations")
          .select("translated_text")
          .eq("content_key", text)
          .eq("language_code", lang.code)
          .maybeSingle();
        if (controller.signal.aborted) return;
        if (data?.translated_text) {
          memoryCache.set(key, data.translated_text);
          setTranslated(data.translated_text);
          return;
        }
        // Fallback: edge function (Phase 8). Silently no-op if missing.
        const { data: fnData, error } = await supabase.functions.invoke("translate-content", {
          body: { texts: [text], target_lang: lang.code },
        });
        if (controller.signal.aborted || error) return;
        const result = fnData?.translations?.[0];
        if (result && result !== text) {
          memoryCache.set(key, result);
          setTranslated(result);
        }
      } catch {
        /* keep original */
      }
    })();

    return () => controller.abort();
  }, [text, lang.code]);

  return translated;
}

export function useTranslatedTexts(texts: (string | undefined | null)[]): string[] {
  const { lang } = useLanguage();
  const valid = texts.filter(Boolean) as string[];
  const [results, setResults] = useState<string[]>(valid);

  useEffect(() => {
    if (valid.length === 0) {
      setResults([]);
      return;
    }
    if (lang.code === "en") {
      setResults(valid);
      return;
    }
    const allCached = valid.every((t) => memoryCache.has(cacheKey(t, lang.code)));
    if (allCached) {
      setResults(valid.map((t) => memoryCache.get(cacheKey(t, lang.code))!));
      return;
    }
    setResults(valid); // originals while loading

    const controller = new AbortController();
    (async () => {
      const uncached = valid.filter((t) => !memoryCache.has(cacheKey(t, lang.code)));
      if (uncached.length === 0) return;
      try {
        const { data, error } = await supabase.functions.invoke("translate-content", {
          body: { texts: uncached, target_lang: lang.code },
        });
        if (controller.signal.aborted || error) return;
        const arr: string[] = data?.translations || uncached;
        uncached.forEach((t, i) => {
          if (arr[i]) memoryCache.set(cacheKey(t, lang.code), arr[i]);
        });
        setResults(valid.map((t) => memoryCache.get(cacheKey(t, lang.code)) || t));
      } catch {
        /* keep originals */
      }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid.join("||"), lang.code]);

  return results;
}
