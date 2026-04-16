import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_WIDGET_ORDER, type WidgetConfig } from "@/components/home/widgetRegistry";

const colToStr = (n: number): "left" | "right" => (n === 1 ? "right" : "left");
const strToCol = (s: "left" | "right"): number => (s === "right" ? 1 : 0);

export type RowSlots = [string | null, string | null];
export interface Row {
  id: string;
  slots: RowSlots;
}

const ROW_LAYOUT_KEY = "home_layout_rows_v1";

const newRowId = () => `row_${Math.random().toString(36).slice(2, 9)}`;

function loadRowLayout(): Row[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ROW_LAYOUT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((r) => r && Array.isArray(r.slots) && r.slots.length === 2);
  } catch {
    return null;
  }
}

function saveRowLayout(rows: Row[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ROW_LAYOUT_KEY, JSON.stringify(rows));
}

function defaultRowsFromVisible(widgets: WidgetConfig[]): Row[] {
  return widgets
    .filter((w) => w.visible)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((w) => ({ id: newRowId(), slots: [w.id, null] as RowSlots }));
}

function reconcileRows(rows: Row[], widgets: WidgetConfig[]): Row[] {
  const visibleIds = new Set(widgets.filter((w) => w.visible).map((w) => w.id));
  // Strip slots that point to hidden / unknown widgets
  const cleaned: Row[] = rows.map((r) => ({
    id: r.id,
    slots: [
      r.slots[0] && visibleIds.has(r.slots[0]) ? r.slots[0] : null,
      r.slots[1] && visibleIds.has(r.slots[1]) ? r.slots[1] : null,
    ] as RowSlots,
  }));
  // Append any visible widgets that aren't in any row
  const placed = new Set<string>();
  cleaned.forEach((r) => r.slots.forEach((s) => s && placed.add(s)));
  widgets
    .filter((w) => w.visible && !placed.has(w.id))
    .sort((a, b) => a.sort_order - b.sort_order)
    .forEach((w) => cleaned.push({ id: newRowId(), slots: [w.id, null] }));
  // Drop fully empty rows (keep at least one)
  const trimmed = cleaned.filter((r) => r.slots[0] || r.slots[1]);
  return trimmed.length > 0 ? trimmed : [{ id: newRowId(), slots: [null, null] }];
}

export function useWidgetPreferences() {
  const { user } = useAuth();
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGET_ORDER);
  const [rowLayout, setRowLayout] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const { data: prefs } = await supabase
        .from("widget_preferences")
        .select("widget_id, visible, sort_order, column")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true });

      let nextWidgets: WidgetConfig[] = DEFAULT_WIDGET_ORDER;

      if (prefs && prefs.length > 0) {
        const prefMap = new Map(prefs.map((p: any) => [p.widget_id, p]));
        const merged = DEFAULT_WIDGET_ORDER.map((w) => {
          const p = prefMap.get(w.id);
          return p
            ? { id: w.id, visible: p.visible, sort_order: p.sort_order, column: colToStr(p.column ?? 0) }
            : w;
        });
        merged.sort((a, b) => a.sort_order - b.sort_order);
        nextWidgets = merged;
      } else {
        const { data: defaults } = await supabase
          .from("widget_defaults")
          .select("widget_id, visible, sort_order")
          .order("sort_order", { ascending: true });
        if (defaults && defaults.length > 0) {
          const defMap = new Map(defaults.map((d: any) => [d.widget_id, d]));
          const merged = DEFAULT_WIDGET_ORDER.map((w) => {
            const d = defMap.get(w.id);
            return d ? { id: w.id, visible: d.visible, sort_order: d.sort_order, column: w.column } : w;
          });
          merged.sort((a, b) => a.sort_order - b.sort_order);
          nextWidgets = merged;
        }
      }

      setWidgets(nextWidgets);

      const stored = loadRowLayout();
      const reconciled = stored
        ? reconcileRows(stored, nextWidgets)
        : defaultRowsFromVisible(nextWidgets);
      setRowLayout(reconciled);
      saveRowLayout(reconciled);
      setLoaded(true);
    };

    load();
  }, [user]);

  const persistRowLayout = useCallback((rows: Row[]) => {
    setRowLayout(rows);
    saveRowLayout(rows);
  }, []);

  const savePreferences = useCallback(
    async (updated: WidgetConfig[]) => {
      if (!user) return;
      setWidgets(updated);

      // Reconcile rows so newly-visible widgets show up and hidden ones disappear
      const reconciled = reconcileRows(rowLayout, updated);
      persistRowLayout(reconciled);

      const rows = updated.map((w) => ({
        user_id: user.id,
        widget_id: w.id,
        visible: w.visible,
        sort_order: w.sort_order,
        column: strToCol(w.column),
      }));

      await supabase.from("widget_preferences").delete().eq("user_id", user.id);
      await supabase.from("widget_preferences").insert(rows);
    },
    [user, rowLayout, persistRowLayout]
  );

  const resetToDefaults = useCallback(async () => {
    if (!user) return;
    await supabase.from("widget_preferences").delete().eq("user_id", user.id);
    if (typeof window !== "undefined") localStorage.removeItem(ROW_LAYOUT_KEY);

    const { data: defaults } = await supabase
      .from("widget_defaults")
      .select("widget_id, visible, sort_order")
      .order("sort_order", { ascending: true });

    let next: WidgetConfig[];
    if (defaults && defaults.length > 0) {
      const defMap = new Map(defaults.map((d: any) => [d.widget_id, d]));
      next = DEFAULT_WIDGET_ORDER.map((w) => {
        const d = defMap.get(w.id);
        return d ? { id: w.id, visible: d.visible, sort_order: d.sort_order, column: w.column } : w;
      }).sort((a, b) => a.sort_order - b.sort_order);
    } else {
      next = DEFAULT_WIDGET_ORDER;
    }
    setWidgets(next);
    persistRowLayout(defaultRowsFromVisible(next));
  }, [user, persistRowLayout]);

  // Row helpers
  const moveWidget = useCallback(
    (widgetId: string, toRowId: string, toSlot: 0 | 1) => {
      const rows = rowLayout.map((r) => ({ id: r.id, slots: [...r.slots] as RowSlots }));
      // Remove widget from existing slot
      for (const r of rows) {
        if (r.slots[0] === widgetId) r.slots[0] = null;
        if (r.slots[1] === widgetId) r.slots[1] = null;
      }
      const target = rows.find((r) => r.id === toRowId);
      if (!target) return;
      const displaced = target.slots[toSlot];
      target.slots[toSlot] = widgetId;
      // If something was displaced, push it to slot 0 of a new row at the bottom
      if (displaced && displaced !== widgetId) {
        rows.push({ id: newRowId(), slots: [displaced, null] });
      }
      // Collapse: if both slots null, remove (but keep at least one row)
      const trimmed = rows.filter((r) => r.slots[0] || r.slots[1]);
      const final = trimmed.length > 0 ? trimmed : [{ id: newRowId(), slots: [null, null] as RowSlots }];
      // Auto-shift: if a row has [null, X], shift X to slot 0
      final.forEach((r) => {
        if (!r.slots[0] && r.slots[1]) {
          r.slots[0] = r.slots[1];
          r.slots[1] = null;
        }
      });
      persistRowLayout(final);
    },
    [rowLayout, persistRowLayout]
  );

  const addRow = useCallback(() => {
    persistRowLayout([...rowLayout, { id: newRowId(), slots: [null, null] }]);
  }, [rowLayout, persistRowLayout]);

  const removeRow = useCallback(
    (rowId: string) => {
      // Hide widgets that were in this row
      const row = rowLayout.find((r) => r.id === rowId);
      if (!row) return;
      const idsInRow = row.slots.filter(Boolean) as string[];
      if (idsInRow.length > 0) {
        const nextWidgets = widgets.map((w) =>
          idsInRow.includes(w.id) ? { ...w, visible: false } : w
        );
        savePreferences(nextWidgets);
      }
      const next = rowLayout.filter((r) => r.id !== rowId);
      persistRowLayout(next.length > 0 ? next : [{ id: newRowId(), slots: [null, null] }]);
    },
    [rowLayout, widgets, savePreferences, persistRowLayout]
  );

  const splitRow = useCallback(
    (rowId: string) => {
      // Add an empty slot 1 so the user can drop into it. If slot[1] already exists, no-op.
      const next = rowLayout.map((r) =>
        r.id === rowId && !r.slots[1] && r.slots[0]
          ? { ...r, slots: [r.slots[0], null] as RowSlots }
          : r
      );
      // We can't really "split" without a target widget — so we just ensure render mode
      // shows the empty placeholder. Mark this by toggling — handled in Index via splitMode set.
      persistRowLayout(next);
    },
    [rowLayout, persistRowLayout]
  );

  return {
    widgets,
    rowLayout,
    loaded,
    savePreferences,
    resetToDefaults,
    moveWidget,
    addRow,
    removeRow,
    splitRow,
  };
}
