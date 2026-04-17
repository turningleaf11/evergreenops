import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Calendar, Target, Users, FileText, Activity as ActivityIcon, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ProjectInfoSidebarProps {
  project: any;
  goalTitle?: string;
  linkedDocs: any[];
  profiles: { user_id: string; full_name: string | null }[];
  onOpenGoal?: () => void;
  onOpenDoc?: (id: string) => void;
}

const avatarColors = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-pink-500",
];

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}
function hashColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return avatarColors[Math.abs(h) % avatarColors.length];
}

interface ActivityItem {
  id: string;
  action: string;
  actor_id: string | null;
  created_at: string;
  metadata: any;
}

export default function ProjectInfoSidebar({
  project, goalTitle, linkedDocs, profiles, onOpenGoal,
}: ProjectInfoSidebarProps) {
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityOpen, setActivityOpen] = useState(false);

  useEffect(() => {
    if (!project?.id) return;
    supabase
      .from("entity_activity")
      .select("*")
      .eq("entity_type", "project")
      .eq("entity_id", project.id)
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => { if (data) setActivity(data as any); });
  }, [project?.id]);

  const ownerName = profiles.find(p => p.user_id === project.owner_id)?.full_name || null;
  const teamIds = [
    project.owner_id,
    ...(project.assignees || []),
  ].filter((v, i, a) => v && a.indexOf(v) === i);

  const teamMembers = teamIds
    .map(uid => profiles.find(p => p.user_id === uid))
    .filter(Boolean) as { user_id: string; full_name: string | null }[];

  const getName = (uid: string | null) => {
    if (!uid) return "System";
    return profiles.find(p => p.user_id === uid)?.full_name || "Someone";
  };

  const describeAction = (a: ActivityItem) => {
    const m = a.metadata || {};
    if (a.action === "status_changed") return `set status → ${m.new_status}`;
    if (a.action === "priority_changed") return `priority → ${m.new_priority}`;
    if (a.action === "title_changed") return `renamed project`;
    if (a.action === "assigned") return `assigned to ${m.assignee_name || "someone"}`;
    if (a.action === "created") return `created this project`;
    return a.action.replace(/_/g, " ");
  };

  const timeAgo = (d: string) => {
    const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  };

  return (
    <aside className="w-[280px] shrink-0 border-l bg-muted/10 px-5 py-6 overflow-y-auto h-full">
      {/* Workspace info header */}
      <div className="mb-6">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Workspace
        </h3>

        {/* Linked Goal */}
        {goalTitle && (
          <button
            onClick={onOpenGoal}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-card border border-border/40 hover:bg-muted/50 transition-colors mb-2 text-left"
          >
            <Target className="h-3.5 w-3.5 text-primary/70 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-muted-foreground">Linked goal</p>
              <p className="text-xs font-medium truncate">{goalTitle}</p>
            </div>
          </button>
        )}

        {/* Due date */}
        {project.due_date && (
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-card border border-border/40 mb-2">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-muted-foreground">Due</p>
              <p className="text-xs font-medium">{format(new Date(project.due_date + "T00:00:00"), "MMM d, yyyy")}</p>
            </div>
          </div>
        )}
      </div>

      {/* Team */}
      <div className="mb-6">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3 w-3" /> Team
        </h3>
        {teamMembers.length === 0 ? (
          <p className="text-xs text-muted-foreground">No members yet</p>
        ) : (
          <ul className="space-y-1.5">
            {teamMembers.map(m => {
              const name = m.full_name || "Unknown";
              return (
                <li key={m.user_id} className="flex items-center gap-2">
                  <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white shrink-0", hashColor(name))}>
                    {initials(name)}
                  </div>
                  <span className="text-xs truncate">{name}</span>
                  {m.user_id === project.owner_id && (
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground ml-auto">Owner</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Files */}
      <div className="mb-6">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <FileText className="h-3 w-3" /> Files
          <span className="text-muted-foreground/60">({linkedDocs.length})</span>
        </h3>
        {linkedDocs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No documents</p>
        ) : (
          <ul className="space-y-1">
            {linkedDocs.slice(0, 5).map(d => (
              <li key={d.id} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground truncate">
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate">{d.title}</span>
              </li>
            ))}
            {linkedDocs.length > 5 && (
              <li className="text-[10px] text-muted-foreground italic pl-5">+{linkedDocs.length - 5} more</li>
            )}
          </ul>
        )}
      </div>

      {/* Recent activity (collapsed) */}
      <div className="mb-2">
        <button
          onClick={() => setActivityOpen(o => !o)}
          className="w-full flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground mb-2"
        >
          <span className="flex items-center gap-1.5">
            <ActivityIcon className="h-3 w-3" /> Recent activity
          </span>
          <ChevronRight className={cn("h-3 w-3 transition-transform", activityOpen && "rotate-90")} />
        </button>
        {activityOpen && (
          <ul className="space-y-2 pl-1">
            {activity.length === 0 ? (
              <li className="text-xs text-muted-foreground">No activity yet</li>
            ) : (
              activity.map(a => (
                <li key={a.id} className="text-[11px] text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground/70">{getName(a.actor_id)}</span>{" "}
                  {describeAction(a)}
                  <span className="text-muted-foreground/50"> · {timeAgo(a.created_at)}</span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </aside>
  );
}
