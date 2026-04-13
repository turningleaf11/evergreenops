import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity } from "lucide-react";

interface ActivityEvent {
  id: string;
  entity_type: string;
  entity_id: string;
  actor_id: string | null;
  action: string;
  metadata: Record<string, any>;
  created_at: string;
}

interface EntityActivityProps {
  entityType: string;
  entityId: string;
}

export default function EntityActivity({ entityType, entityId }: EntityActivityProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from("entity_activity")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) {
      setEvents(data as ActivityEvent[]);
      const ids = [...new Set(data.filter(e => e.actor_id).map(e => e.actor_id!))];
      if (ids.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
        if (profs) {
          const map: Record<string, string> = {};
          profs.forEach(p => { map[p.user_id] = p.full_name || "Unknown"; });
          setProfiles(map);
        }
      }
    }
  }, [entityType, entityId]);

  useEffect(() => { fetch(); }, [fetch]);

  const timeAgo = (d: string) => {
    const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const describeAction = (e: ActivityEvent) => {
    const actor = e.actor_id ? profiles[e.actor_id] || "Someone" : "System";
    const meta = e.metadata || {};
    switch (e.action) {
      case "status_changed": return `${actor} changed status to ${meta.new_status || "unknown"}`;
      case "assigned": return `${actor} assigned to ${meta.assignee_name || "someone"}`;
      case "created": return `${actor} created this ${entityType}`;
      case "commented": return `${actor} added a comment`;
      case "priority_changed": return `${actor} changed priority to ${meta.new_priority || "unknown"}`;
      default: return `${actor} ${e.action.replace(/_/g, " ")}`;
    }
  };

  if (events.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Activity</h3>
      </div>
      <div className="space-y-2">
        {events.map(e => (
          <div key={e.id} className="flex items-start gap-2 text-xs text-muted-foreground">
            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 mt-1.5 shrink-0" />
            <span>{describeAction(e)}</span>
            <span className="ml-auto shrink-0">{timeAgo(e.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
