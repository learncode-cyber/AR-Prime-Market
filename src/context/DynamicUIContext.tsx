import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DynamicSetting = {
  component_name: string;
  css_classes: string;
  json_data: Record<string, unknown>;
  is_active: boolean;
  updated_at: string;
};

type Ctx = {
  settings: Record<string, DynamicSetting>;
  loading: boolean;
};

const DynamicUIContext = createContext<Ctx>({ settings: {}, loading: true });

export function DynamicUIProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Record<string, DynamicSetting>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data } = await supabase.rpc("get_active_dynamic_ui_settings");
      if (!mounted) return;
      const map: Record<string, DynamicSetting> = {};
      (data ?? []).forEach((row) => {
        map[row.component_name] = {
          component_name: row.component_name,
          css_classes: row.css_classes ?? "",
          json_data: (row.json_data as Record<string, unknown>) ?? {},
          is_active: !!row.is_active,
          updated_at: row.updated_at ?? "",
        };
      });
      setSettings(map);
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel("dynamic_ui_settings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dynamic_ui_settings" },
        (payload) => {
          setSettings((prev) => {
            const next = { ...prev };
            const newRow = payload.new as Partial<DynamicSetting> | undefined;
            const oldRow = payload.old as Partial<DynamicSetting> | undefined;
            if (payload.eventType === "DELETE" && oldRow?.component_name) {
              delete next[oldRow.component_name];
              return next;
            }
            if (newRow?.component_name) {
              if (!newRow.is_active) {
                delete next[newRow.component_name];
              } else {
                next[newRow.component_name] = {
                  component_name: newRow.component_name,
                  css_classes: (newRow.css_classes as string) ?? "",
                  json_data: (newRow.json_data as Record<string, unknown>) ?? {},
                  is_active: true,
                  updated_at: (newRow.updated_at as string) ?? "",
                };
              }
            }
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const value = useMemo(() => ({ settings, loading }), [settings, loading]);
  return <DynamicUIContext.Provider value={value}>{children}</DynamicUIContext.Provider>;
}

/** Read live tailwind classes + JSON data for a named component. */
export function useDynamicUI(componentName: string): DynamicSetting | null {
  const ctx = useContext(DynamicUIContext);
  return ctx.settings[componentName] ?? null;
}

/** Compose base classes with admin-managed overrides. */
export function useDynamicClasses(componentName: string, fallback = ""): string {
  const setting = useDynamicUI(componentName);
  return setting?.css_classes ? `${fallback} ${setting.css_classes}`.trim() : fallback;
}
