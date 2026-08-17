import { useCallback, useEffect, useState } from "react";

/**
 * Persists which board columns/stages a user wants to see, per board, per
 * device — same localStorage convention as useViewPreference.
 *
 * @example
 *   const [visible, toggle] = useStageVisibility("execution:tasks", ["backlog","todo","in_progress","blocked","done"]);
 */
export function useStageVisibility(boardKey: string, defaultVisible: string[]) {
  const storageKey = `pref:${boardKey}:visible-stages`;
  const [visible, setVisible] = useState<string[]>(() => {
    if (typeof window === "undefined") return defaultVisible;
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as string[]) : defaultVisible;
    } catch {
      return defaultVisible;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(visible));
    } catch {
      /* ignore quota errors */
    }
  }, [storageKey, visible]);

  const toggle = useCallback((key: string) => {
    setVisible(current =>
      current.includes(key) ? current.filter(k => k !== key) : [...current, key]
    );
  }, []);

  return [visible, toggle] as const;
}
