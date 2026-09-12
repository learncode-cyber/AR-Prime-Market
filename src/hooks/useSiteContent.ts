import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SiteContent {
  id: string;
  section_key: string;
  section_label: string;
  content: Record<string, any>;
  is_active: boolean;
  updated_at: string;
}

async function fetchSiteContent(): Promise<SiteContent[]> {
  const { data, error } = await supabase
    .from("site_content" as any)
    .select("*")
    .eq("is_active", true);
  if (error) throw error;
  return (data as any[]) || [];
}

export function useSiteContent() {
  return useQuery({
    queryKey: ["site_content"],
    queryFn: fetchSiteContent,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSectionContent<T = Record<string, any>>(sectionKey: string): T | null {
  const { data } = useSiteContent();
  const section = data?.find((s) => s.section_key === sectionKey);
  return (section?.content as T) ?? null;
}

export function useInvalidateSiteContent() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["site_content"] });
}

export async function updateSiteContent(sectionKey: string, content: Record<string, any>) {
  const { error } = await supabase
    .from("site_content" as any)
    .update({ content, updated_at: new Date().toISOString() } as any)
    .eq("section_key", sectionKey);
  if (error) throw error;
}
