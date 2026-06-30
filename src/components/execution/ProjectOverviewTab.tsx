import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Crown, FileSignature, Paperclip, Flag, Plus, Target, ChevronDown } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import RichTextEditor from "@/components/RichTextEditor";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  project: any;
  tasks: any[];
  goals?: { id: string; title: string }[];
  profiles: { user_id: string; full_name: string | null; avatar_url?: string | null }[];
  onNotesChange: (html: string) => void;
  onGoalChange: (goalId: string | null) => void;
  onOpenGoal: (goalId: string) => void;
}

interface ActivityEvent {
  id: string;
  actor_id: string | null;
  action: string;
  metadata: Record<string, any>;
  created_at: string;
}

function describeEvent(e: ActivityEvent, actorName: string) {
  const meta = e.metadata || {};
  switch (e.action) {
    case "created": return `${actorName} created this project`;
    case "status_changed": return `${actorName} changed status to ${meta.new_status || "—"}`;
    case "priority_changed": return `${actorName} set priority to ${meta.new_priority || "—"}`;
    case "title_changed": return `${actorName} renamed this project`;
    case "owner_changed": return `${actorName} updated the owner`;
    default: return `${actorName} ${e.action.replace(/_/g, " ")}`;
  }
}

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ProjectOverviewTab({
  project, goals = [], profiles, onNotesChange, onGoalChange, onOpenGoal,
}: Props) {
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  const fetchActivity = useCallback(async () => {
    const { data } = await supabase
      .from("entity_activity")
      .select("*")
      .eq("entity_type", "project")
      .eq("entity_id", project.id)
      .order("created_at", { ascending: false })
      .limit(6);
    setEvents((data as ActivityEvent[]) || []);
  }, [project.id]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  const getName = (uid: string | null) =>
    !uid ? "Someone" : profiles.find((p) => p.user_id === uid)?.full_name || "Unknown";

  const teamIds = [project.owner_id, ...(project.assignees || [])].filter(
    (v, i, a) => v && a.indexOf(v) === i,
  );
  const team = teamIds.map((id) => profiles.find((p) => p.user_id === id)).filter(Boolean) as any[];

  const connectedGoal = goals.find((g) => g.id === project.goal_id);

  return (
    <div className="flex gap-8">
      <div className="flex-1 min-w-0 space-y-7">
        <section>
          <div className="rounded-xl border border-border/50 bg-card/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</h4>
              <button
                onClick={() => setNotesExpanded((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {notesExpanded ? "Collapse" : "Expand"}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${notesExpanded ? "rotate-180" : ""}`} />
              </button>
            </div>
            <div className={`overflow-y-auto transition-[max-height] duration-200 ${notesExpanded ? "max-h-[480px]" : "max-h-[140px]"}`}>
              <RichTextEditor
                content={project.notes_content || ""}
                onChange={onNotesChange}
                placeholder="Start writing project notes, plans, context…"
                borderless
              />
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-2.5">Project roles</h3>
          {team.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members yet.</p>
          ) : (
            <div className="space-y-1.5">
              {team.map((m) => (
                <div key={m.user_id} className="flex items-center gap-2.5 text-sm">
                  <UserAvatar name={m.full_name || "U"} avatarUrl={m.avatar_url} className="h-7 w-7" fallbackClassName="bg-muted text-[10px]" />
                  <span className="font-medium">{m.full_name || "Unknown"}</span>
                  {m.user_id === project.owner_id && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Crown className="h-3 w-3" /> Owner
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-2.5">Connected goals</h3>
          {connectedGoal ? (
            <button
              onClick={() => onOpenGoal(connectedGoal.id)}
              className="w-full flex items-center gap-2 rounded-lg border border-border/60 px-4 py-3 text-sm hover:bg-accent/30 transition-colors text-left"
            >
              <Target className="h-4 w-4 text-muted-foreground shrink-0" />
              {connectedGoal.title}
            </button>
          ) : goals.length > 0 ? (
            <Select value="" onValueChange={(v) => onGoalChange(v)}>
              <SelectTrigger className="w-full h-auto py-3 border-dashed text-xs text-muted-foreground">
                <SelectValue placeholder="Connect this project to a larger goal" />
              </SelectTrigger>
              <SelectContent>
                {goals.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <div className="w-full rounded-lg border border-dashed border-border/60 py-5 flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
              <Target className="h-4 w-4" />
              No goals to connect yet
            </div>
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-2.5">Key resources</h3>
          <div className="rounded-lg border border-border/60 p-4 flex items-center justify-center gap-6 text-xs text-muted-foreground/70" title="Not built yet">
            <span className="flex items-center gap-1.5">
              <FileSignature className="h-3.5 w-3.5" /> Create project brief
            </span>
            <span className="flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5" /> Add links &amp; files
            </span>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-2.5 flex items-center gap-1.5">
            Milestones <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          </h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground/60 border-t border-border/40 pt-2.5" title="Not built yet">
            <Flag className="h-3.5 w-3.5" /> Add a milestone
          </div>
        </section>
      </div>

      {/* Right rail — status + activity, mirrors the Project Detail Page
          pattern in autumn-design-system */}
      <aside className="w-[260px] shrink-0 space-y-4">
        <div className="rounded-lg border border-border/60 p-3">
          <span className="text-xs font-semibold">Recent activity</span>
        </div>
        <div className="space-y-3">
          {events.length === 0 && (
            <p className="text-xs text-muted-foreground">No activity yet.</p>
          )}
          {events.map((ev) => {
            const actorName = ev.actor_id ? getName(ev.actor_id) : "System";
            return (
              <div key={ev.id} className="flex items-start gap-2.5 text-xs">
                <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-medium shrink-0 mt-0.5">
                  {actorName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-foreground/90">{describeEvent(ev, actorName)}</p>
                  <p className="text-muted-foreground mt-0.5">{timeAgo(ev.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
