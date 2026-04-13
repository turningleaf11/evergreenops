import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useActivityLog() {
  const { user, profile } = useAuth();

  const logActivity = useCallback(
    async (action: string, entityType: string, entityId?: string, entityTitle?: string, departmentId?: string) => {
      if (!user) return;
      await supabase.from("activity_events").insert({
        actor_id: user.id,
        actor_name: profile?.full_name || "Unknown",
        action,
        entity_type: entityType,
        entity_id: entityId || null,
        entity_title: entityTitle || null,
        department_id: departmentId || null,
      } as any);
    },
    [user, profile]
  );

  return { logActivity };
}
