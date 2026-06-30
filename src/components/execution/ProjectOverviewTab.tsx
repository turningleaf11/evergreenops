import { Crown, FileSignature, Paperclip, Flag, Plus, Target } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CollapsibleNotes } from "@/components/primitives";

interface Props {
  project: any;
  tasks: any[];
  goals?: { id: string; title: string }[];
  profiles: { user_id: string; full_name: string | null; avatar_url?: string | null }[];
  onNotesChange: (html: string) => void;
  onGoalChange: (goalId: string | null) => void;
  onOpenGoal: (goalId: string) => void;
}

export default function ProjectOverviewTab({
  project, goals = [], profiles, onNotesChange, onGoalChange, onOpenGoal,
}: Props) {
  const teamIds = [project.owner_id, ...(project.assignees || [])].filter(
    (v, i, a) => v && a.indexOf(v) === i,
  );
  const team = teamIds.map((id) => profiles.find((p) => p.user_id === id)).filter(Boolean) as any[];
  const connectedGoal = goals.find((g) => g.id === project.goal_id);

  return (
    <div className="space-y-7">
        <section>
          <CollapsibleNotes
            content={project.notes_content || ""}
            onChange={onNotesChange}
            placeholder="Start writing project notes, plans, context…"
          />
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
  );
}
