import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Calendar, Star, ListChecks, AlertOctagon, ArrowRight, Loader2 } from "lucide-react";
import { format, startOfWeek, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { createLeadershipMeetingWithAgenda } from "@/lib/leadership-agenda";
import { LeadershipMeetingDetail } from "./LeadershipMeetingDetail";

interface Meeting {
  id: string;
  meeting_date: string;
  meeting_week: string;
  status: string;
  rating: number | null;
}

interface RowExtras {
  actionCount: number;
  resolvedIssueCount: number;
}

export function LeadershipMeetingsTab() {
  const { user, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [extras, setExtras] = useState<Record<string, RowExtras>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("leadership"));
  const [autoCheckRan, setAutoCheckRan] = useState(false);

  // Sync URL → state when ?leadership=... changes
  useEffect(() => {
    const fromUrl = searchParams.get("leadership");
    if (fromUrl && fromUrl !== selectedId) setSelectedId(fromUrl);
  }, [searchParams, selectedId]);

  const today = new Date();
  const isThursday = today.getDay() === 4;
  const todayMonday = startOfWeek(today, { weekStartsOn: 1 });
  const todayMondayStr = todayMonday.toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: meetingRows } = await supabase
      .from("leadership_meetings" as any)
      .select("id, meeting_date, meeting_week, status, rating")
      .order("meeting_date", { ascending: false })
      .limit(50);
    const list = (meetingRows as any[]) || [];
    setMeetings(list);

    if (list.length > 0) {
      const ids = list.map((m) => m.id);
      const [actionsRes, agendaRes] = await Promise.all([
        supabase.from("leadership_meeting_action_items" as any).select("meeting_id").in("meeting_id", ids),
        supabase
          .from("meeting_agenda_items" as any)
          .select("meeting_id, section, status")
          .in("meeting_id", ids)
          .eq("section", "issues"),
      ]);
      const ex: Record<string, RowExtras> = {};
      for (const id of ids) ex[id] = { actionCount: 0, resolvedIssueCount: 0 };
      for (const a of (actionsRes.data as any[]) || []) {
        if (ex[a.meeting_id]) ex[a.meeting_id].actionCount += 1;
      }
      for (const i of (agendaRes.data as any[]) || []) {
        if (ex[i.meeting_id] && (i.status === "resolved" || i.status === "discussed")) {
          ex[i.meeting_id].resolvedIssueCount += 1;
        }
      }
      setExtras(ex);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Thursday auto-create — only attempted by admins (RLS would block others)
  useEffect(() => {
    if (autoCheckRan || loading || !isAdmin || !isThursday) return;
    setAutoCheckRan(true);
    const exists = meetings.some((m) => m.meeting_week === todayMondayStr);
    if (exists) return;
    (async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("workspace_id")
          .eq("user_id", user?.id || "")
          .maybeSingle();
        await createLeadershipMeetingWithAgenda({
          meetingDate: today,
          createdBy: user?.id ?? null,
          workspaceId: (profile as any)?.workspace_id ?? null,
        });
        load();
      } catch (e: any) {
        // silent — non-admins won't have permission anyway
        console.warn("auto-create skipped:", e.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAdmin, isThursday, meetings, autoCheckRan]);

  const todaysMeeting = meetings.find((m) => isSameDay(new Date(m.meeting_date), today));

  const handleCreate = async () => {
    if (!isAdmin) return;
    setCreating(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("workspace_id")
        .eq("user_id", user?.id || "")
        .maybeSingle();
      const { id, created } = await createLeadershipMeetingWithAgenda({
        meetingDate: today,
        createdBy: user?.id ?? null,
        workspaceId: (profile as any)?.workspace_id ?? null,
      });
      toast({
        title: created ? "Meeting created" : "Meeting already exists",
        description: created ? "Agenda has been auto-populated." : "Opening existing meeting for this week.",
      });
      await load();
      setSelectedId(id);
    } catch (e: any) {
      toast({ title: "Could not create meeting", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  if (selectedId) {
    return <LeadershipMeetingDetail meetingId={selectedId} onBack={() => {
      setSelectedId(null);
      const next = new URLSearchParams(searchParams);
      next.delete("leadership");
      setSearchParams(next, { replace: true });
      load();
    }} />;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">Leadership Meetings</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Weekly structured meetings — auto-built from live data every Thursday.</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
            New Meeting
          </Button>
        )}
      </div>

      {/* Thursday banner */}
      {isThursday && todaysMeeting && (
        <button
          onClick={() => setSelectedId(todaysMeeting.id)}
          className="w-full flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 px-4 py-3 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium">Your weekly leadership meeting is today.</p>
              <p className="text-xs text-muted-foreground">{format(today, "EEEE, MMM d")}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            Open Meeting <ArrowRight className="h-3 w-3" />
          </span>
        </button>
      )}

      {/* List */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" /> Loading meetings…
        </div>
      ) : meetings.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">No leadership meetings yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              {isAdmin ? "Click \"New Meeting\" to start one — agenda will auto-populate." : "Meetings will appear here once an admin creates one."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {meetings.map((m) => {
            const ex = extras[m.id] || { actionCount: 0, resolvedIssueCount: 0 };
            return (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className="w-full text-left rounded-lg border border-border/60 bg-card hover:bg-muted/30 hover:border-border transition-colors px-4 py-3 flex items-center gap-4"
              >
                <div className="text-sm font-medium min-w-[140px]">
                  {format(new Date(m.meeting_date), "EEE, MMM d, yyyy")}
                </div>
                <StatusPill status={m.status} />
                {m.status === "completed" && m.rating !== null && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                    {m.rating}/10
                  </span>
                )}
                <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <ListChecks className="h-3 w-3" /> {ex.actionCount} actions
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <AlertOctagon className="h-3 w-3" /> {ex.resolvedIssueCount} resolved
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
    in_progress: { label: "In Progress", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    completed: { label: "Completed", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  };
  const v = map[status] || map.draft;
  return <Badge variant="outline" className={cn("text-[10px] font-medium", v.cls)}>{v.label}</Badge>;
}
