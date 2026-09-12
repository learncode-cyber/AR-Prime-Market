import { supabase } from "@/integrations/supabase/client";

export type KeyStatus = {
  configured: boolean;
  lastConnectedAt: string | null;
  expiresAt: string | null;
};

export type CjListItem = {
  pid: string;
  productName?: string;
  productNameEn?: string;
  productImage?: string;
  sellPrice?: number | string;
  productStatus?: number;
};

export type ImportedProduct = {
  id: string;
  cj_pid: string;
  product_name: string;
  product_image: string | null;
  sell_price: number | null;
  product_status: number;
  stock_info: any;
  last_synced_at: string;
};

export type WebhookEvent = {
  id: string;
  event_type: string;
  cj_pid: string | null;
  payload: any;
  status: string;
  error_message: string | null;
  processed_at: string | null;
  received_at: string;
};

export async function callProxy<T = any>(
  action: string,
  payload: Record<string, any> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("cj-proxy", {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message || "Request failed");
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export function getWebhookUrl(): string {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  return `${base}/functions/v1/cj-webhook`;
}
