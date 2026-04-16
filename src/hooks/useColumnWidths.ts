import { useState, useCallback, useEffect } from "react";

const STORAGE_PREFIX = "spreadsheet:";

/**
 * Per-user, persisted column widths for spreadsheet/list views.
 * Backed by localStorage so it survives reloads but is local to this device.
 */
export function useColumnWidths(viewKey: string, defaultWidth = 160) {
  const storageKey = `${STORAGE_PREFIX}${viewKey}`;
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(widths));
    } catch {
      // ignore quota errors
    }
  }, [widths, storageKey]);

  const setWidth = useCallback((columnId: string, width: number) => {
    setWidths((prev) => ({ ...prev, [columnId]: Math.max(60, Math.round(width)) }));
  }, []);

  const getWidth = useCallback(
    (columnId: string) => widths[columnId] ?? defaultWidth,
    [widths, defaultWidth],
  );

  return { widths, setWidth, getWidth };
}
