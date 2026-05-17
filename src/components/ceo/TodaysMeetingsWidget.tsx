import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, Star, ArrowRight, Plus, Loader2 } from "lucide-react";
import { startOfWeek, format } from "date-fns";
import { createLeadershipMeetingWithAgenda } from "@/lib/leadership-agenda";
import { toast } from "@/hooks/use-toast";

const sb = supabase as any;

type Item = {
  id: string;
  title: string;
  status: string;
  href: string;
  meta?: string;
};

/**
 * Compact "Today's Meetings" widget for the CEO cockpit Today tab.
 *
 * For now this surfaces the in-app leadership_meetings entry if it's scheduled
 * today, plus a "Connect Google Calendar" CTA in the empty state. Real Google
 * Calendar sync lands in a follow-up session.
 *
 * Renders nothing when there is genuinely nothing to surface — we don't burn
 * top-of-page real estate on an empty card.
 */
export function TodaysMeetingsWidget() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [gcalConnected, setGcalConnected] = useState(false);

  const today = new Date();
  const todayIso = format(today, "yyyy-MM-dd");
  const isThursday = today.getDay() === 4;
  const monday = startOfWeek(today, { weekStartsOn: 1 }).toISOString().slice(0, 10);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const surfaced: Item[] = [];

      // 1. Leadership meeting if scheduled today
      const { data: lm } = await sb
        .from("leadership_meetings")
        .select("id, meeting_date, status, rating")
        .eq("meeting_date", todayIso)
        .maybeSingle();
      if (lm) {
        surfaced.push({
          id: lm.id,
          title: "Leadership meeting",
          status: lm.status,
          href: `/meetings?leadership=${lm.id}`,
          meta: lm.rating ? `${lm.rating}/10` : "10:00 AM",
        });
      } else if (isThursday) {
        // Thursday w/o meeting yet — show a placeholder so the user can create one
        const { data: lmWeek } = await sb
          .from("leadership_meetings")
          .select("id, status")
          .eq("meeting_week", monday)
          .maybeSingle();
        if (lmWeek) {
          surfaced.push({
            id: lmWeek.id,
            title: "Leadership meeting",
            status: lmWeek.status,
            href: `/meetings?leadership=${lmWeek.id}`,
            meta: "Today",
          });
        }
      }

      // 2. Check if Google Calendar is connected (presence of gmail_tokens means user did OAuth)
      const { data: gtok } = await sb
        .from("gmail_tokens")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) setGcalConnected(!!gtok);

      if (!cancelled) {
        setItems(surfaced);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, todayIso, isThursday, monday]);

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

  if (loading) return null;
  // Don't render if nothing today and Thursday-but-no-meeting flow doesn't apply
  if (items.length === 0 && !isThursday) return null;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 p-4 elevation-1">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Today's Meetings</h2>
        </div>
        <Link to="/meetings" className="text-[11px] text-muted-foreground/60 hover:text-foreground">View all</Link>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">No leadership meeting scheduled for today.</p>
          {isAdmin && (
            <button onClick={handleCreate} disabled={creating} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80">
              {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Create
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-1">
          {items.map((m) => (
            <li key={m.id}>
              <Link to={m.href} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors">
                {m.status === "completed" && <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />}
                <span className="text-sm text-foreground truncate flex-1">{m.title}</span>
                {m.meta && <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{m.meta}</span>}
                <ArrowRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!gcalConnected && (
        <Link
          to="/settings#integrations"
          className="mt-3 block text-[11px] text-muted-foreground/70 hover:text-foreground border-t border-border/40 pt-2"
        >
          Connect Google Calendar to see your full day →
        </Link>
      )}
    </div>
  );
}
