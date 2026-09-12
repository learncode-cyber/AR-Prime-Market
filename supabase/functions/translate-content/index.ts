// Edge Function: translate-content
// Translates an array of strings to target language using Gemini.
// Caches results in public.translations (content_key + language_code -> translated_text).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAdmin } from "../_shared/auth.ts";
import { geminiGenerate, isGeminiConfiguredDb } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;
  try {
    const { texts, target_lang } = await req.json();
    if (!Array.isArray(texts) || !target_lang) {
      return json({ error: "texts[] and target_lang required" }, 400);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Lookup cache
    const { data: cached } = await supabase
      .from("translations")
      .select("content_key, translated_text")
      .eq("language_code", target_lang)
      .in("content_key", texts);
    const cacheMap = new Map<string, string>(
      (cached || []).map((r: any) => [r.content_key, r.translated_text]),
    );

    const missing = texts.filter((t: string) => !cacheMap.has(t));
    if (missing.length > 0) {
      if (!(await isGeminiConfiguredDb()))
        return json({ error: "Gemini API key not configured" }, 500);

      const prompt = `Translate each line below to ${target_lang}. Return ONLY a JSON array of strings, same order, same length. No commentary.\n\n${JSON.stringify(missing)}`;
      let content = "";
      try {
        content = await geminiGenerate({ prompt, temperature: 0.2, surface: "translate" });
      } catch (e) {
        return json({ error: `Gemini: ${String(e)}` }, 502);
      }
      let parsed: string[] = [];
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
      } catch {
        parsed = missing;
      }
      // Persist
      const rows = missing.map((t: string, i: number) => ({
        content_key: t,
        language_code: target_lang,
        translated_text: parsed[i] || t,
      }));
      if (rows.length > 0) {
        await supabase
          .from("translations")
          .upsert(rows, { onConflict: "language_code,content_key" });
      }
      rows.forEach((r) => cacheMap.set(r.content_key, r.translated_text));
    }

    const translations = texts.map((t: string) => cacheMap.get(t) || t);
    return json({ translations });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
