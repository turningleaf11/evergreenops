import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, FileText, Database, Users, Settings, Zap, Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActivityEvent {
  id: string;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_title: string | null;
  created_at: string;
}

const actionLabels: Record<string, string> = {
  created_doc: "created a document",
  updated_doc: "updated a document",
  deleted_doc: "deleted a document",
  created_database: "created a database",
  deleted_database: "deleted a database",
  created_row: "added a database row",
  invited_user: "invited a user",
  updated_role: "updated a user role",
  created_department: "created a department",
  deleted_department: "deleted a department",
  created_module: "created a training module",
  created_strategy: "created a strategy item",
};

const entityIcons: Record<string, React.ElementType> = {
  document: FileText,
  database: Database,
  user: Users,
  department: Settings,
  training: Zap,
  strategy: Zap,
};

export function ActivityFeed({ limit = 20 }: { limit?: number }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      const { data } = await supabase
        .from("activity_events")
        .select("id, actor_name, action, entity_type, entity_title, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (data) setEvents(data);
      setLoading(false);
    };
    fetchEvents();

    // Realtime subscription
    const channel = supabase
      .channel("activity_feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_events" }, (payload) => {
        setEvents((prev) => [payload.new as ActivityEvent, ...prev].slice(0, limit));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [limit]);

  if (loading) return <div className="text-sm text-muted-foreground text-center py-4">Loading activity...</div>;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" /> Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No activity yet.</p>
        ) : (
          <div className="space-y-3">
            {events.map((event) => {
              const Icon = entityIcons[event.entity_type] || Activity;
              const label = actionLabels[event.action] || event.action;
              return (
                <div key={event.id} className="flex items-start gap-3 text-sm">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p>
                      <span className="font-medium">{event.actor_name || "Someone"}</span>{" "}
                      <span className="text-muted-foreground">{label}</span>
                      {event.entity_title && (
                        <span className="font-medium"> "{event.entity_title}"</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    const fetchRecent = async () => {
      const { data } = await supabase
        .from("activity_events")
        .select("id, actor_name, action, entity_type, entity_title, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      if (data) setEvents(data);
    };
    fetchRecent();

    const channel = supabase
      .channel("notification_bell")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_events" }, (payload) => {
        setCount((c) => c + 1);
        setEvents((prev) => [payload.new as ActivityEvent, ...prev].slice(0, 5));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); setCount(0); }}
        className="relative p-2 rounded-md hover:bg-muted transition-colors"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border bg-popover shadow-lg z-50 p-3">
          <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Notifications</p>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No recent notifications.</p>
          ) : (
            <div className="space-y-2">
              {events.map((e) => (
                <div key={e.id} className="text-xs p-2 rounded hover:bg-muted transition-colors">
                  <span className="font-medium">{e.actor_name}</span>{" "}
                  <span className="text-muted-foreground">{actionLabels[e.action] || e.action}</span>
                  {e.entity_title && <span className="font-medium"> "{e.entity_title}"</span>}
                  <p className="text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
