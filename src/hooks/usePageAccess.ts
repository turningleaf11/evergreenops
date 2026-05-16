import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const sb = supabase as any;

/**
 * Page keys for the per-user access grants system.
 * Pages NOT in this list are gated by role only (admin/leader) with no per-user grants.
 */
export const PAGE_KEYS = [
  "execution",
  "process_map",
  "crm",
  "meetings",
  "lists",
  "forms",
  "ai_hub",
  "market_research",
  "content_studio",
  "ai_workshop",
] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

export const PAGE_LABELS: Record<PageKey, string> = {
  execution: "Execution Hub",
  process_map: "Process Map",
  crm: "CRM / Deals",
  meetings: "Meetings",
  lists: "Lists",
  forms: "Forms",
  ai_hub: "AI Hub",
  market_research: "Market Research",
  content_studio: "Content Studio",
  ai_workshop: "AI Workshop",
};

/**
 * Returns the current user's set of granted page keys plus a loading flag.
 * Admins always implicitly have access to everything — callers should still check that first.
 */
export function usePageGrants() {
  const { user, isAdmin } = useAuth();
  const [grants, setGrants] = useState<Set<PageKey>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setGrants(new Set());
      setLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await sb.from("page_grants").select("page_key").eq("user_id", user.id);
      if (cancelled) return;
      setGrants(new Set((data ?? []).map((r: any) => r.page_key as PageKey)));
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [user, isAdmin]);

  return { grants, loaded };
}

/**
 * Returns whether the current user can access a given page based on role + grants.
 *  - minRole "admin": admin only, unless explicitly granted
 *  - minRole "leader": admin or leader, unless explicitly granted
 *  - minRole "primary_admin": CEO only, unless explicitly granted
 */
export function usePageAccess(pageKey: PageKey, minRole: "admin" | "leader" | "primary_admin") {
  const { isAdmin, isLeader, isPrimaryAdmin } = useAuth();
  const { grants, loaded } = usePageGrants();

  const hasRoleAccess =
    (minRole === "primary_admin" && isPrimaryAdmin) ||
    (minRole === "admin" && isAdmin) ||
    (minRole === "leader" && isLeader);

  const hasGrantAccess = grants.has(pageKey);
  return { allowed: hasRoleAccess || hasGrantAccess, loaded };
}
