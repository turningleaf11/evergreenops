import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Syncs a piece of state to a URL query param (e.g. ?task=<id>) so refreshing
 * the page keeps you where you were instead of losing whatever was open.
 * Reads the initial value from the URL on mount; writes it back (or removes
 * it when set to null) whenever it changes, using replace so it doesn't spam
 * browser history. Merges with whatever else is already in the query string.
 */
export function useUrlState(key: string, initial: string | null = null) {
  const navigate = useNavigate();
  const [value, setValue] = useState<string | null>(() => {
    if (typeof window === "undefined") return initial;
    return new URLSearchParams(window.location.search).get(key) ?? initial;
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const current = params.get(key);
    if (current === value) return;
    if (value === null) params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    navigate(`${window.location.pathname}${qs ? `?${qs}` : ""}`, { replace: true });
  }, [value]);

  return [value, setValue] as const;
}
