import { useEffect, useRef, useState } from "react";
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

interface PersonalNotification {
  id: string;
  actor_name: string | null;
  type: string;
  body: string;
  url: string | null;
  read_at: string | null;
  created_at: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [personal, setPersonal] = useState<PersonalNotification[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const unreadCount = personal.filter((n) => !n.read_at).length;

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted || !user) return;
      setUserId(user.id);

      const [{ data: notifs }, { data: acts }] = await Promise.all([
        supabase
          .from("notifications")
          .select("id, actor_name, type, body, url, read_at, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("activity_events")
          .select("id, actor_name, action, entity_type, entity_title, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      if (!mounted) return;
      if (notifs) setPersonal(notifs as PersonalNotification[]);
      if (acts) setEvents(acts as ActivityEvent[]);

      const channel = supabase
        .channel("notification_bell")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          (payload) => {
            setPersonal((prev) => [payload.new as PersonalNotification, ...prev].slice(0, 20));
          },
        )
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_events" }, (payload) => {
          setEvents((prev) => [payload.new as ActivityEvent, ...prev].slice(0, 5));
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    })();
    return () => { mounted = false; };
  }, []);

  const markAllRead = async () => {
    if (!userId) return;
    const unread = personal.filter((n) => !n.read_at).map((n) => n.id);
    if (unread.length === 0) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unread);
    setPersonal((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
  };

  const handleClick = async (n: PersonalNotification) => {
    if (!n.read_at) {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
      setPersonal((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    }
    if (n.url) window.location.href = n.url;
  };

  const closeTimer = useRef<number | null>(null);
  const cancelClose = () => {
    if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = null; }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 250);
  };

  return (
    <div className="relative" onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-md hover:bg-muted transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 rounded-lg border bg-popover shadow-lg z-50 p-3 max-h-[480px] overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">For you</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[10px] text-primary hover:text-primary/80">
                Mark all read
              </button>
            )}
          </div>
          {personal.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No notifications yet.</p>
          ) : (
            <div className="space-y-1">
              {personal.slice(0, 10).map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left text-xs p-2 rounded transition-colors ${n.read_at ? "hover:bg-muted" : "bg-primary/5 hover:bg-primary/10"}`}
                >
                  <div>
                    <span className="font-medium">{n.actor_name || "Someone"}</span>{" "}
                    <span className="text-muted-foreground">{n.body}</span>
                  </div>
                  <p className="text-muted-foreground/70 mt-0.5">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                </button>
              ))}
            </div>
          )}

          {events.length > 0 && (
            <>
              <p className="text-xs font-semibold mt-3 mb-2 text-muted-foreground uppercase tracking-wider">Recent activity</p>
              <div className="space-y-1">
                {events.map((e) => (
                  <div key={e.id} className="text-xs p-2 rounded hover:bg-muted transition-colors">
                    <span className="font-medium">{e.actor_name}</span>{" "}
                    <span className="text-muted-foreground">{actionLabels[e.action] || e.action}</span>
                    {e.entity_title && <span className="font-medium"> "{e.entity_title}"</span>}
                    <p className="text-muted-foreground/70 mt-0.5">{formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
