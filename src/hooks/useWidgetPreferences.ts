import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_WIDGET_ORDER, type WidgetConfig } from "@/components/home/widgetRegistry";

export function useWidgetPreferences() {
  const { user } = useAuth();
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGET_ORDER);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      // 1. Check user preferences
      const { data: prefs } = await supabase
        .from("widget_preferences")
        .select("widget_id, visible, sort_order")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true });

      if (prefs && prefs.length > 0) {
        // Merge with registry to pick up any new widgets
        const prefMap = new Map(prefs.map((p) => [p.widget_id, p]));
        const merged = DEFAULT_WIDGET_ORDER.map((w) => {
          const p = prefMap.get(w.id);
          return p ? { id: w.id, visible: p.visible, sort_order: p.sort_order } : w;
        });
        merged.sort((a, b) => a.sort_order - b.sort_order);
        setWidgets(merged);
        setLoaded(true);
        return;
      }

      // 2. Fall back to admin defaults
      const { data: defaults } = await supabase
        .from("widget_defaults")
        .select("widget_id, visible, sort_order")
        .order("sort_order", { ascending: true });

      if (defaults && defaults.length > 0) {
        const defMap = new Map(defaults.map((d) => [d.widget_id, d]));
        const merged = DEFAULT_WIDGET_ORDER.map((w) => {
          const d = defMap.get(w.id);
          return d ? { id: w.id, visible: d.visible, sort_order: d.sort_order } : w;
        });
        merged.sort((a, b) => a.sort_order - b.sort_order);
        setWidgets(merged);
        setLoaded(true);
        return;
      }

      // 3. Hardcoded defaults
      setWidgets(DEFAULT_WIDGET_ORDER);
      setLoaded(true);
    };

    load();
  }, [user]);

  const savePreferences = useCallback(
    async (updated: WidgetConfig[]) => {
      if (!user) return;
      setWidgets(updated);

      // Upsert all widget prefs
      const rows = updated.map((w) => ({
        user_id: user.id,
        widget_id: w.id,
        visible: w.visible,
        sort_order: w.sort_order,
      }));

      // Delete existing and insert fresh
      await supabase.from("widget_preferences").delete().eq("user_id", user.id);
      await supabase.from("widget_preferences").insert(rows);
    },
    [user]
  );

  const resetToDefaults = useCallback(async () => {
    if (!user) return;
    await supabase.from("widget_preferences").delete().eq("user_id", user.id);

    // Reload defaults
    const { data: defaults } = await supabase
      .from("widget_defaults")
      .select("widget_id, visible, sort_order")
      .order("sort_order", { ascending: true });

    if (defaults && defaults.length > 0) {
      const defMap = new Map(defaults.map((d) => [d.widget_id, d]));
      const merged = DEFAULT_WIDGET_ORDER.map((w) => {
        const d = defMap.get(w.id);
        return d ? { id: w.id, visible: d.visible, sort_order: d.sort_order } : w;
      });
      merged.sort((a, b) => a.sort_order - b.sort_order);
      setWidgets(merged);
    } else {
      setWidgets(DEFAULT_WIDGET_ORDER);
    }
  }, [user]);

  return { widgets, loaded, savePreferences, resetToDefaults };
}
