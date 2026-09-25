import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export type ImportSource = "cj_dropshipping" | "aliexpress";

export interface PreviewData {
  product_id: string;
  title: string;
  image_url: string | null;
  cogs: number;
  retail_price: number;
  compare_price: number;
  variant_count: number;
  margin_percent: string;
}

function extractProductId(input: string): string {
  const trimmed = input.trim();
  // Raw SKU like CJJT177988403CX or pure numeric pid
  if (!/[\/\s?#]/.test(trimmed)) return trimmed;

  // CJ pattern: ...-p-<digits>(.html)?
  const cjPid = trimmed.match(/-p-(\d{6,})(?:[._-][^/?#]*)?(?:\.html?)?(?:[/?#]|$)/i);
  if (cjPid) return cjPid[1];

  // AliExpress pattern: /item/<digits>.html
  const aeItem = trimmed.match(/\/item\/(\d{6,})/i);
  if (aeItem) return aeItem[1];

  // ?productSku=XXX or ?pid=XXX or ?id=XXX
  try {
    const u = new URL(trimmed.startsWith("http") ? trimmed : `https://x/${trimmed}`);
    const q =
      u.searchParams.get("productSku") || u.searchParams.get("pid") || u.searchParams.get("id");
    if (q) return q;
  } catch {
    /* ignore */
  }

  // Generic fallback: prefer a long numeric segment, then a SKU-like token
  const parts = trimmed.split(/[/?#]/).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const seg = parts[i].replace(/\.(html?|php)$/i, "");
    const numMatch = seg.match(/(\d{10,})/);
    if (numMatch) return numMatch[1];
    if (/^CJ[A-Z0-9]{6,}$/i.test(seg)) return seg;
  }
  return parts[parts.length - 1] || trimmed;
}

export function useProductImporter() {
  const navigate = useNavigate();
  const [source, setSource] = useState<ImportSource>("cj_dropshipping");
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  async function handleFetchPreview() {
    if (!inputValue.trim()) return;
    setIsLoading(true);
    setError(null);
    setPreviewData(null);
    setImportSuccess(false);

    const product_id = extractProductId(inputValue);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke("import-product", {
        body: { source, product_id, product_url: inputValue },
      });

      if (fnErr) {
        setError(fnErr.message || "Import request failed");
        return;
      }
      if (!data?.success) {
        setError(data?.error || "Unknown error from importer");
        return;
      }

      const cogs = Number(data.cogs ?? 0);
      const retail = Number(data.retail_price ?? 0);
      const compare = Number(data.compare_price ?? Math.ceil(retail * 1.25));
      const marginPct = retail > 0 ? (((retail - cogs - 3.99) / retail) * 100).toFixed(1) : "0.0";

      setPreviewData({
        product_id: data.product_id,
        title: data.title,
        image_url: data.image_url,
        cogs,
        retail_price: retail,
        compare_price: compare,
        variant_count: Number(data.variant_count ?? 0),
        margin_percent: marginPct,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setIsLoading(false);
    }
  }

  function handleConfirmImport() {
    if (!previewData) return;
    setImportSuccess(true);
    navigate({ to: "/kali_master/products" });
  }

  return {
    source,
    setSource,
    inputValue,
    setInputValue,
    isLoading,
    previewData,
    error,
    importSuccess,
    handleFetchPreview,
    handleConfirmImport,
  };
}
