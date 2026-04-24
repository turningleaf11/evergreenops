import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, ArrowRight, Star, Loader2, Plus } from "lucide-react";
import { startOfWeek } from "date-fns";
import { createLeadershipMeetingWithAgenda } from "@/lib/leadership-agenda";
import { toast } from "@/hooks/use-toast";

interface Meeting {
  id: string;
  meeting_date: string;
  meeting_week: string;
  status: string;
  rating: number | null;
}

export function ThisWeeksMeetingWidget() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [agendaCount, setAgendaCount] = useState(0);
  const [actionCount, setActionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const today = new Date();
  const isThursday = today.getDay() === 4;
  const monday = startOfWeek(today, { weekStartsOn: 1 }).toISOString().slice(0, 10);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("leadership_meetings" as any)
      .select("id, meeting_date, meeting_week, status, rating")
      .eq("meeting_week", monday)
      .maybeSingle();
    const m = (data as any as Meeting) || null;
    setMeeting(m);
    if (m) {
      const [agRes, acRes] = await Promise.all([
        supabase.from("meeting_agenda_items" as any).select("id", { count: "exact", head: true }).eq("meeting_id", m.id),
        supabase.from("leadership_meeting_action_items" as any).select("id", { count: "exact", head: true }).eq("meeting_id", m.id),
      ]);
      setAgendaCount(agRes.count ?? 0);
      setActionCount(acRes.count ?? 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monday]);

  const handleCreate = async () => {
    if (!isAdmin) return;
    setCreating(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("workspace_id")
        .eq("user_id", user?.id || "")
        .maybeSingle();
      const { id } = await createLeadershipMeetingWithAgenda({
        meetingDate: today,
        createdBy: user?.id ?? null,
        workspaceId: (profile as any)?.workspace_id ?? null,
      });
      navigate(`/meetings?leadership=${id}`);
    } catch (e: any) {
      toast({ title: "Could not create meeting", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const meetingHref = meeting ? `/meetings?leadership=${meeting.id}` : "/meetings";

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 p-5 elevation-1">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">This Week's Meeting</h2>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
        </div>
      ) : !meeting ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">No meeting scheduled this week.</p>
          {isAdmin ? (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Create
            </button>
          ) : (
            <Link to="/meetings" className="text-xs text-muted-foreground hover:text-foreground">View</Link>
          )}
        </div>
      ) : meeting.status === "completed" ? (
        <div>
          <div className="flex items-center gap-3 text-sm">
            {meeting.rating != null && (
              <span className="inline-flex items-center gap-1 font-medium">
                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> {meeting.rating}/10
              </span>
            )}
            <span className="text-muted-foreground">
              {actionCount} action item{actionCount === 1 ? "" : "s"}
            </span>
          </div>
          <Link
            to={meetingHref}
            className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-primary hover:text-primary/80"
          >
            View Summary <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : isThursday ? (
        <div>
          <p className="text-sm">Leadership meeting today at 10am.</p>
          <Link
            to={meetingHref}
            className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-primary hover:text-primary/80"
          >
            Open Meeting · {agendaCount} agenda items <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <div>
          <p className="text-sm text-muted-foreground">
            {meeting.status === "in_progress" ? "Meeting in progress" : "Meeting drafted"} · {agendaCount} agenda items
          </p>
          <Link
            to={meetingHref}
            className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-primary hover:text-primary/80"
          >
            Open Meeting <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
