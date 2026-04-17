import { Calendar, FileText, Target, User, Users } from "lucide-react";
import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface ProjectInfoSidebarProps {
  project: any;
  goalTitle?: string;
  linkedDocs: any[];
  profiles: { user_id: string; full_name: string | null }[];
  onOpenGoal?: () => void;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ProjectInfoSidebar({
  project,
  goalTitle,
  linkedDocs,
  profiles,
  onOpenGoal,
}: ProjectInfoSidebarProps) {
  const ownerName = profiles.find((p) => p.user_id === project.owner_id)?.full_name || "Unassigned";
  const teamIds = [project.owner_id, ...(project.assignees || [])].filter(
    (value, index, all) => value && all.indexOf(value) === index,
  );
  const teamMembers = teamIds
    .map((userId) => profiles.find((p) => p.user_id === userId))
    .filter(Boolean) as { user_id: string; full_name: string | null }[];

  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 p-4 backdrop-blur-sm lg:sticky lg:top-6">
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workspace</p>
      </div>

      <div className="space-y-3">
        {goalTitle && (
          <button
            onClick={onOpenGoal}
            className="flex w-full items-start gap-3 rounded-xl border border-border/40 bg-background/60 px-3 py-3 text-left transition-colors hover:bg-muted/40"
          >
            <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Goal</p>
              <p className="truncate text-sm font-medium text-foreground">{goalTitle}</p>
            </div>
          </button>
        )}

        <div className="rounded-xl border border-border/40 bg-background/60 px-3 py-3">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{ownerName}</span>
          </div>
          <p className="mt-1 pl-6 text-[11px] uppercase tracking-wide text-muted-foreground">Owner</p>
        </div>

        {project.due_date && (
          <div className="rounded-xl border border-border/40 bg-background/60 px-3 py-3">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{format(new Date(project.due_date + "T00:00:00"), "MMM d, yyyy")}</span>
            </div>
            <p className="mt-1 pl-6 text-[11px] uppercase tracking-wide text-muted-foreground">Due date</p>
          </div>
        )}

        <div className="rounded-xl border border-border/40 bg-background/60 px-3 py-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
            <Users className="h-4 w-4 text-muted-foreground" />
            Team
          </div>
          {teamMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members yet.</p>
          ) : (
            <div className="space-y-2">
              {teamMembers.map((member) => {
                const name = member.full_name || "Unknown";
                return (
                  <div key={member.user_id} className="flex items-center gap-2.5">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-muted text-[10px] text-foreground">
                        {initials(name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 truncate text-sm text-foreground">{name}</span>
                    {member.user_id === project.owner_id && (
                      <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">Owner</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border/40 bg-background/60 px-3 py-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Files
            <span className="text-xs text-muted-foreground">({linkedDocs.length})</span>
          </div>
          {linkedDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents yet.</p>
          ) : (
            <div className="space-y-2">
              {linkedDocs.slice(0, 4).map((doc) => (
                <div key={doc.id} className="truncate text-sm text-foreground/80">
                  {doc.title}
                </div>
              ))}
              {linkedDocs.length > 4 && (
                <p className="text-xs text-muted-foreground">+{linkedDocs.length - 4} more</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
