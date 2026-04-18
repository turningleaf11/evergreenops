import { useCallback, useEffect, useState } from "react";

/**
 * Persists a UI preference (like view mode) to localStorage so it
 * survives reloads and is remembered per-device.
 *
 * @example
 *   const [view, setView] = useViewPreference<"list"|"board">("execution:projects:view", "list");
 */
export function useViewPreference<T extends string>(key: string, defaultValue: T) {
  const storageKey = `pref:${key}`;
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const raw = window.localStorage.getItem(storageKey);
      return (raw as T) || defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, value);
    } catch {
      /* ignore quota errors */
    }
  }, [storageKey, value]);

  const update = useCallback((next: T) => setValue(next), []);

  return [value, update] as const;
}
