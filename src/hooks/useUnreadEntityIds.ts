import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * The set of entity ids (of one type) with unread notifications for the
 * current user — drives the unread dot on task/project cards and rows.
 * Refreshes on a realtime notifications change so a new comment lights up
 * the indicator without a manual reload.
 */
export function useUnreadEntityIds(entityType: "task" | "project") {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!user) { setIds(new Set()); return; }
    const { data } = await supabase.from("notifications")
      .select("entity_id")
      .eq("user_id", user.id)
      .eq("entity_type", entityType)
      .is("read_at", null);
    setIds(new Set((data || []).map((r) => r.entity_id)));
  }, [user, entityType]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`unread-${entityType}-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, entityType, refresh]);

  return ids;
}
