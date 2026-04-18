import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, X, Target, FolderKanban, FileText, MessageSquare, ChevronDown, CircleDot, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import RichTextEditor from "@/components/RichTextEditor";
import CommentsSection from "@/components/CommentsSection";
import EntityActivity from "@/components/EntityActivity";
import LinkProjectPicker from "./LinkProjectPicker";

interface KeyResult { label?: string; title?: string; target?: string; current?: string; done?: boolean; }

interface GoalPeekProps {
  goalId: string | null;
  onClose: () => void;
  allProjects: { id: string; title: string; goal_id: string | null; status: string; owner_id: string | null; due_date: string | null }[];
  getName: (uid: string | null) => string;
  onChanged: () => void;
  onOpenProject: (projectId: string) => void;
}

const statusOptions = [
  { value: "on_track", label: "On Track", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  { value: "behind", label: "Behind", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
  { value: "at_risk", label: "At Risk", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  { value: "done", label: "Done", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  { value: "not_done", label: "Not Done", color: "bg-muted text-muted-foreground" },
];

const projectStatusDot: Record<string, string> = {
  not_started: "bg-muted-foreground",
  in_progress: "bg-blue-500",
  done: "bg-green-500",
  blocked: "bg-red-500",
};

export default function GoalPeek({ goalId, onClose, allProjects, getName, onChanged, onOpenProject }: GoalPeekProps) {
  const [goal, setGoal] = useState<any>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [krsOpen, setKrsOpen] = useState(true);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(true);
  const [discussionOpen, setDiscussionOpen] = useState(true);

  const fetchGoal = useCallback(async () => {
    if (!goalId) return;
    const { data } = await supabase.from("goals").select("*").eq("id", goalId).single();
    if (data) { setGoal(data); setTitleDraft(data.title); }
  }, [goalId]);

  useEffect(() => { if (goalId) fetchGoal(); else setGoal(null); }, [goalId, fetchGoal]);

  if (!goalId || !goal) {
    return (
      <Dialog open={!!goalId} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl p-0" />
      </Dialog>
    );
  }

  const linkedProjects = allProjects.filter(p => p.goal_id === goalId);
  const doneProjects = linkedProjects.filter(p => p.status === "done").length;
  const progress = linkedProjects.length > 0
    ? Math.round((doneProjects / linkedProjects.length) * 100)
    : goal.progress || 0;

  const update = async (patch: Record<string, any>) => {
    const { error } = await supabase.from("goals").update(patch as any).eq("id", goalId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { setGoal((g: any) => ({ ...g, ...patch })); onChanged(); }
  };

  const saveTitle = () => {
    if (titleDraft.trim() && titleDraft !== goal.title) update({ title: titleDraft.trim() });
    setEditingTitle(false);
  };

  const krs: KeyResult[] = Array.isArray(goal.key_results) ? goal.key_results : [];

  const updateKr = (idx: number, patch: Partial<KeyResult>) => {
    const next = krs.map((k, i) => i === idx ? { ...k, ...patch } : k);
    update({ key_results: next });
  };
  const addKr = () => update({ key_results: [...krs, { label: "", target: "", current: "" }] });
  const removeKr = (idx: number) => update({ key_results: krs.filter((_, i) => i !== idx) });

  const unlinkProject = async (projectId: string) => {
    const { error } = await supabase.from("projects").update({ goal_id: null }).eq("id", projectId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { onChanged(); fetchGoal(); }
  };

  const currentStatus = statusOptions.find(s => s.value === goal.status);

  return (
    <Dialog open={!!goalId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 space-y-3 border-b border-border/50 sticky top-0 bg-background/95 backdrop-blur z-10">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Target className="h-3.5 w-3.5 text-primary/70" />
            <span className="font-medium">Goal · {goal.quarter} {goal.year}</span>
          </div>
          <DialogTitle asChild>
            {editingTitle ? (
              <Input
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={e => e.key === "Enter" && saveTitle()}
                autoFocus
                className="text-2xl font-bold h-auto py-1 px-2 border-none shadow-none focus-visible:ring-1"
              />
            ) : (
              <h2
                onClick={() => setEditingTitle(true)}
                className="text-2xl font-bold cursor-pointer hover:bg-accent/30 rounded-md px-2 -mx-2 py-1 transition-colors"
              >
                {goal.title}
              </h2>
            )}
          </DialogTitle>
          {goal.description !== null && (
            <Input
              value={goal.description || ""}
              onChange={e => setGoal({ ...goal, description: e.target.value })}
              onBlur={() => update({ description: goal.description })}
              placeholder="Add a short description..."
              className="border-none shadow-none px-2 -mx-2 text-sm text-muted-foreground focus-visible:ring-1"
            />
          )}
          <div className="flex items-center gap-3">
            <Select value={goal.status} onValueChange={v => update({ status: v })}>
              <SelectTrigger className="h-7 w-auto border-none shadow-none px-2 gap-1 focus:ring-0 focus-visible:ring-0 [&>svg:last-child]:hidden">
                <Badge className={cn("text-[10px] rounded-full px-2.5 py-0.5 border-0 pointer-events-none", currentStatus?.color)}>
                  {currentStatus?.label}
                </Badge>
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" /> {getName(goal.owner_id)}
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="px-6 py-6 space-y-6">
          {/* Key Results */}
          <Collapsible open={krsOpen} onOpenChange={setKrsOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-semibold text-foreground/80 hover:text-foreground py-1">
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !krsOpen && "-rotate-90")} />
              <CircleDot className="h-3.5 w-3.5" /> Key Results
              <span className="text-[11px] font-normal text-muted-foreground ml-1">({krs.length})</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-1.5">
              {krs.map((kr, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <Input
                    value={kr.label || kr.title || ""}
                    onChange={e => updateKr(i, { label: e.target.value })}
                    placeholder="Result label"
                    className="h-8 text-sm flex-1"
                  />
                  <Input
                    value={kr.current ?? ""}
                    onChange={e => updateKr(i, { current: e.target.value })}
                    placeholder="0"
                    className="h-8 text-sm w-16"
                  />
                  <span className="text-xs text-muted-foreground">/</span>
                  <Input
                    value={kr.target ?? ""}
                    onChange={e => updateKr(i, { target: e.target.value })}
                    placeholder="100"
                    className="h-8 text-sm w-16"
                  />
                  <button onClick={() => removeKr(i)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={addKr} className="h-7 text-xs text-muted-foreground">
                <Plus className="h-3 w-3 mr-1" /> Add key result
              </Button>
            </CollapsibleContent>
          </Collapsible>

          {/* Key Projects */}
          <Collapsible open={projectsOpen} onOpenChange={setProjectsOpen}>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-foreground/80 hover:text-foreground py-1">
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !projectsOpen && "-rotate-90")} />
                <FolderKanban className="h-3.5 w-3.5" /> Key Projects
                <span className="text-[11px] font-normal text-muted-foreground ml-1">({linkedProjects.length})</span>
              </CollapsibleTrigger>
              <LinkProjectPicker goalId={goalId} allProjects={allProjects} onLinked={() => { onChanged(); fetchGoal(); }} />
            </div>
            <CollapsibleContent className="pt-3 space-y-1.5">
              {linkedProjects.map(p => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/30 hover:bg-muted/60 cursor-pointer group transition-colors"
                  onClick={() => onOpenProject(p.id)}
                >
                  <div className={cn("h-2 w-2 rounded-full shrink-0", projectStatusDot[p.status] || "bg-muted")} />
                  <span className="text-sm font-medium truncate flex-1">{p.title}</span>
                  <span className="text-[11px] text-muted-foreground">{getName(p.owner_id)}</span>
                  <button
                    onClick={e => { e.stopPropagation(); unlinkProject(p.id); }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1"
                    title="Unlink"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {linkedProjects.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No projects linked yet.</p>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Strategy / Notes */}
          <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-semibold text-foreground/80 hover:text-foreground py-1">
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !notesOpen && "-rotate-90")} />
              <FileText className="h-3.5 w-3.5" /> Strategy & Notes
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <RichTextEditor
                content={goal.alignment_notes || ""}
                onChange={html => update({ alignment_notes: html })}
                placeholder="Strategy, context, alignment notes..."
                borderless
              />
            </CollapsibleContent>
          </Collapsible>

          {/* Discussion / Activity */}
          <Collapsible open={discussionOpen} onOpenChange={setDiscussionOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-semibold text-foreground/80 hover:text-foreground py-1">
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !discussionOpen && "-rotate-90")} />
              <MessageSquare className="h-3.5 w-3.5" /> Discussion & Activity
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-4">
              <CommentsSection entityType="goal" entityId={goalId} />
              <div className="pt-3 border-t border-border/40">
                <EntityActivity entityType="goal" entityId={goalId} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </DialogContent>
    </Dialog>
  );
}
