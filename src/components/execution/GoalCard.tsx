import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, FolderKanban, Calendar, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface KeyResult { label?: string; title?: string; target?: string | number; current?: string | number; done?: boolean; }

interface GoalCardProps {
  goal: {
    id: string; title: string; description?: string | null; quarter: string; year: number;
    status: string; owner_id: string | null; key_results?: KeyResult[] | null; progress: number;
    deadline?: string | null;
  };
  projects: { id: string; status: string; due_date?: string | null }[];
  ownerName: string;
  onClick: () => void;
}

const statusStyles: Record<string, string> = {
  on_track: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  behind: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  at_risk: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  done: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  not_done: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  on_track: "On Track", behind: "Behind", at_risk: "At Risk", done: "Done", not_done: "Not Done",
};

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function GoalCard({ goal, projects, ownerName, onClick }: GoalCardProps) {
  const krs = (goal.key_results || []).slice(0, 3);
  const doneProjects = projects.filter(p => p.status === "done").length;
  const activeProjects = projects.filter(p => p.status !== "done" && p.status !== "blocked").length;
  const progress = projects.length > 0
    ? Math.round((doneProjects / projects.length) * 100)
    : goal.progress;

  // Auto-rollup metrics (used when no key results)
  const nextDue = projects
    .filter(p => p.due_date && p.status !== "done")
    .map(p => p.due_date!)
    .sort()[0];

  const metrics = krs.length > 0
    ? krs.map((kr, i) => ({
        key: i,
        label: kr.label || kr.title || "Result",
        value: kr.target ? `${kr.current ?? 0}/${kr.target}` : (kr.done ? "✓" : "—"),
      }))
    : [
        { key: "p", label: "Done", value: `${doneProjects}/${projects.length}` },
        { key: "a", label: "Active", value: String(activeProjects) },
        ...(nextDue ? [{ key: "d", label: "Next", value: nextDue }] : []),
      ];

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all group border-border/50 bg-card/60 backdrop-blur-sm"
    >
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-3.5 w-3.5 text-primary/70 shrink-0" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {goal.quarter} {goal.year}
              </span>
            </div>
            <h3 className="text-base font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-2">
              {goal.title}
            </h3>
            {goal.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{goal.description}</p>
            )}
          </div>
          <Badge className={cn("text-[10px] rounded-full px-2 py-0.5 border-0 shrink-0", statusStyles[goal.status] || "")}>
            {statusLabels[goal.status] || goal.status}
          </Badge>
        </div>

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1" />
        </div>

        {/* Metrics */}
        <div className="flex items-center gap-2 flex-wrap">
          {metrics.map(m => (
            <div key={m.key} className="flex flex-col rounded-md bg-muted/40 px-2 py-1 min-w-0">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/80 truncate">{m.label}</span>
              <span className="text-xs font-semibold truncate">{m.value}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <FolderKanban className="h-3 w-3" />
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {ownerName === "Unassigned" ? (
              <><User className="h-3 w-3" /> Unassigned</>
            ) : (
              <>
                <span className="h-4 w-4 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[8px] font-semibold">
                  {getInitials(ownerName)}
                </span>
                {ownerName}
              </>
            )}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
