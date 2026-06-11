import { format } from "date-fns";
import { Calendar, FileText, Target, User, Users, Plus, X, Check, Eye } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { FollowersPicker } from "@/components/crm/PeoplePickers";

interface ProjectInfoSidebarProps {
  project: any;
  goalTitle?: string;
  linkedDocs: any[];
  profiles: { user_id: string; full_name: string | null; avatar_url?: string | null }[];
  onOpenGoal?: () => void;
  onUpdate?: (updates: Record<string, any>) => void;
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
  onUpdate,
}: ProjectInfoSidebarProps) {
  const ownerName = profiles.find((p) => p.user_id === project.owner_id)?.full_name || "Unassigned";
  const teamIds = [project.owner_id, ...(project.assignees || [])].filter(
    (value, index, all) => value && all.indexOf(value) === index,
  );
  const teamMembers = teamIds
    .map((userId) => profiles.find((p) => p.user_id === userId))
    .filter(Boolean) as { user_id: string; full_name: string | null }[];

  return (
    <section className="rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workspace</p>
          <p className="mt-1 text-sm text-muted-foreground">Key context at a glance.</p>
        </div>
      </div>

      <div className="space-y-4">
        {goalTitle && (
          <button
            onClick={onOpenGoal}
            className="flex w-full items-start gap-3 rounded-xl border border-border/40 bg-background/60 px-3 py-3 text-left transition-colors hover:bg-muted/40"
          >
            <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Linked goal</p>
              <p className="truncate text-sm font-medium text-foreground">{goalTitle}</p>
            </div>
          </button>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
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
        </div>

        <div className="rounded-xl border border-border/40 bg-background/60 px-3 py-3">
          <div className="mb-3 flex items-center justify-between gap-2 text-sm font-medium text-foreground">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Team
            </div>
            {onUpdate && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-1" align="end">
                  <div className="max-h-60 overflow-y-auto">
                    {profiles
                      .filter((p) => p.user_id !== project.owner_id)
                      .map((p) => {
                        const isMember = (project.assignees || []).includes(p.user_id);
                        return (
                          <button
                            key={p.user_id}
                            onClick={() => {
                              const current: string[] = project.assignees || [];
                              const next = isMember
                                ? current.filter((x) => x !== p.user_id)
                                : [...current, p.user_id];
                              onUpdate({ assignees: next });
                            }}
                            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent/60 text-left"
                          >
                            <span className="truncate">{p.full_name || "Unknown"}</span>
                            {isMember && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                          </button>
                        );
                      })}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
          {teamMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members yet.</p>
          ) : (
            <div className="space-y-2">
              {teamMembers.map((member) => {
                const name = member.full_name || "Unknown";
                const isOwner = member.user_id === project.owner_id;
                return (
                  <div key={member.user_id} className="group flex items-center gap-2.5">
                    <UserAvatar name={name} avatarUrl={member.avatar_url} className="h-7 w-7" fallbackClassName="bg-muted text-[10px] text-foreground" />
                    <span className="min-w-0 truncate text-sm text-foreground">{name}</span>
                    {isOwner ? (
                      <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">Lead</span>
                    ) : (
                      onUpdate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                          onClick={() =>
                            onUpdate({
                              assignees: (project.assignees || []).filter((x: string) => x !== member.user_id),
                            })
                          }
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Followers — separate from "Team" because they watch, not work */}
        {onUpdate && (
          <div className="rounded-xl border border-border/40 bg-background/60 px-3 py-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <Eye className="h-4 w-4 text-muted-foreground" />
              Followers
            </div>
            <FollowersPicker
              followerIds={Array.isArray(project.followers) ? project.followers : []}
              ownerId={project.owner_id}
              onChange={(ids) => onUpdate({ followers: ids })}
              label=""
            />
          </div>
        )}

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
              {linkedDocs.slice(0, 3).map((doc) => (
                <div key={doc.id} className="truncate text-sm text-foreground/80">
                  {doc.title}
                </div>
              ))}
              {linkedDocs.length > 3 && (
                <p className="text-xs text-muted-foreground">+{linkedDocs.length - 3} more</p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
