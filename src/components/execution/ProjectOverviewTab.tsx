import { format } from "date-fns";
import { Calendar, CheckCircle2, Circle, Clock, FileText, Target, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Props {
  project: any;
  tasks: any[];
  goalTitle?: string;
  linkedDocs: any[];
  profiles: { user_id: string; full_name: string | null }[];
  onOpenTab: (tab: string) => void;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function stripHtml(html: string) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export default function ProjectOverviewTab({ project, tasks, goalTitle, linkedDocs, profiles, onOpenTab }: Props) {
  const openTasks = tasks.filter((t) => t.status !== "done");
  const upcoming = [...openTasks]
    .sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"))
    .slice(0, 3);

  const teamIds = [project.owner_id, ...(project.assignees || [])].filter(
    (v, i, a) => v && a.indexOf(v) === i,
  );
  const team = teamIds.map((id) => profiles.find((p) => p.user_id === id)).filter(Boolean) as any[];

  const notesPreview = stripHtml(project.notes_content || "").slice(0, 220);

  const getName = (uid: string | null) =>
    uid ? profiles.find((p) => p.user_id === uid)?.full_name || "Unknown" : "Unassigned";

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {/* Notes preview */}
      <button
        onClick={() => onOpenTab("notes")}
        className="md:col-span-2 text-left rounded-2xl border border-border/50 bg-card/40 p-5 hover:bg-card/70 transition-colors group"
      >
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</h3>
        </div>
        {notesPreview ? (
          <p className="text-sm text-foreground/80 line-clamp-4">{notesPreview}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No notes yet — click to start writing.</p>
        )}
        <p className="mt-3 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">Open notes →</p>
      </button>

      {/* Tasks summary */}
      <button
        onClick={() => onOpenTab("tasks")}
        className="text-left rounded-2xl border border-border/50 bg-card/40 p-5 hover:bg-card/70 transition-colors"
      >
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tasks</h3>
        </div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-2xl font-semibold">{openTasks.length}</span>
          <span className="text-xs text-muted-foreground">open · {tasks.length} total</span>
        </div>
        <div className="space-y-1.5">
          {upcoming.length === 0 ? (
            <p className="text-xs text-muted-foreground">All clear.</p>
          ) : (
            upcoming.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-xs">
                {t.status === "in_progress" ? (
                  <Clock className="h-3 w-3 text-primary/70 shrink-0" />
                ) : (
                  <Circle className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
                <span className="truncate flex-1">{t.title}</span>
                {t.due_date && (
                  <span className="text-muted-foreground shrink-0">
                    {format(new Date(t.due_date + "T00:00:00"), "MMM d")}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </button>

      {/* Team */}
      <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team</h3>
        </div>
        {team.length === 0 ? (
          <p className="text-sm text-muted-foreground">No team members yet.</p>
        ) : (
          <div className="space-y-2">
            {team.slice(0, 5).map((m) => (
              <div key={m.user_id} className="flex items-center gap-2.5">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-muted text-[10px]">{initials(m.full_name || "U")}</AvatarFallback>
                </Avatar>
                <span className="text-sm truncate flex-1">{m.full_name || "Unknown"}</span>
                {m.user_id === project.owner_id && (
                  <span className="text-[10px] uppercase text-muted-foreground tracking-wide">Owner</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Goal */}
      <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Linked Goal</h3>
        </div>
        {goalTitle ? (
          <p className="text-sm font-medium">{goalTitle}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Not linked to a goal.</p>
        )}
      </div>

      {/* Due date */}
      <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Due Date</h3>
        </div>
        {project.due_date ? (
          <p className="text-sm font-medium">
            {format(new Date(project.due_date + "T00:00:00"), "MMM d, yyyy")}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No due date set.</p>
        )}
      </div>

      {/* Files */}
      <button
        onClick={() => onOpenTab("files")}
        className="text-left rounded-2xl border border-border/50 bg-card/40 p-5 hover:bg-card/70 transition-colors"
      >
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Files ({linkedDocs.length})
          </h3>
        </div>
        {linkedDocs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents yet.</p>
        ) : (
          <div className="space-y-1.5">
            {linkedDocs.slice(0, 4).map((d) => (
              <p key={d.id} className="text-sm truncate text-foreground/80">{d.title}</p>
            ))}
          </div>
        )}
      </button>
    </div>
  );
}
