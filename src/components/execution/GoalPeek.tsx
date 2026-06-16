import { useState, useEffect, useCallback, useRef } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Plus, X, Target, FolderKanban, FileText,
  ChevronDown, ChevronRight, CircleDot, Loader2, MoreHorizontal, Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import RichTextEditor from "@/components/RichTextEditor";
import LinkProjectPicker from "./LinkProjectPicker";
import { OwnerPicker, FollowersPicker } from "@/components/crm/PeoplePickers";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { appConfirm } from "@/components/AppConfirm";
import {
  StatusBadge,
  GOAL_STATUS_VARIANT, GOAL_STATUS_LABEL,
  PROJECT_STATUS_VARIANT, PROJECT_STATUS_LABEL,
} from "@/components/shared/StatusBadge";
import ActivityPanel from "@/components/activity/ActivityPanel";

interface KeyResult { label?: string; title?: string; target?: string; current?: string; done?: boolean; }

interface GoalPeekProps {
  goalId: string | null;
  onClose: () => void;
  allProjects: { id: string; title: string; goal_id: string | null; status: string; owner_id: string | null; due_date: string | null }[];
  getName: (uid: string | null) => string;
  onChanged: () => void;
  onOpenProject: (projectId: string) => void;
}

const goalStatusOptions = [
  { value: "on_track", label: "On Track" },
  { value: "behind", label: "Behind" },
  { value: "at_risk", label: "At Risk" },
  { value: "done", label: "Done" },
  { value: "not_done", label: "Not Done" },
];

export default function GoalPeek({ goalId, onClose, allProjects, getName, onChanged, onOpenProject }: GoalPeekProps) {
  const [goal, setGoal] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [krsOpen, setKrsOpen] = useState(true);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const krSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchGoal = useCallback(async () => {
    if (!goalId) return;
    setLoading(true);
    const { data } = await supabase.from("goals").select("*").eq("id", goalId).single();
    if (data) setGoal(data);
    setLoading(false);
  }, [goalId]);

  useEffect(() => { if (goalId) fetchGoal(); else setGoal(null); }, [goalId, fetchGoal]);

  const update = async (patch: Record<string, any>) => {
    if (!goalId) return;
    const { error } = await supabase.from("goals").update(patch as any).eq("id", goalId);
    if (error) toast.error(error.message);
    else { setGoal((g: any) => ({ ...g, ...patch })); onChanged(); }
  };

  const handleDeleteGoal = async () => {
    if (!goalId || !goal) return;
    const confirmed = await appConfirm({
      title: "Delete this goal?",
      body: `This will permanently remove "${goal.title}". This action cannot be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!confirmed) return;
    const { error } = await supabase.from("goals").delete().eq("id", goalId);
    if (error) toast.error(error.message);
    else { toast.success("Goal deleted"); onChanged(); onClose(); }
  };

  const krs: KeyResult[] = goal && Array.isArray(goal.key_results) ? goal.key_results : [];

  const persistKrs = (next: KeyResult[]) => {
    if (krSaveTimer.current) clearTimeout(krSaveTimer.current);
    krSaveTimer.current = setTimeout(async () => {
      const { error } = await supabase.from("goals").update({ key_results: next as any }).eq("id", goalId!);
      if (error) toast.error(error.message);
      else onChanged();
    }, 500);
  };
  const updateKr = (idx: number, patch: Partial<KeyResult>) => {
    const next = krs.map((k, i) => i === idx ? { ...k, ...patch } : k);
    setGoal((g: any) => ({ ...g, key_results: next }));
    persistKrs(next);
  };
  const addKr = () => {
    const next = [...krs, { label: "", target: "", current: "" }];
    setGoal((g: any) => ({ ...g, key_results: next }));
    persistKrs(next);
  };
  const removeKr = (idx: number) => {
    const next = krs.filter((_, i) => i !== idx);
    setGoal((g: any) => ({ ...g, key_results: next }));
    persistKrs(next);
  };

  const unlinkProject = async (projectId: string) => {
    const { error } = await supabase.from("projects").update({ goal_id: null }).eq("id", projectId);
    if (error) toast.error(error.message);
    else { onChanged(); fetchGoal(); }
  };

  const linkedProjects = goal ? allProjects.filter(p => p.goal_id === goalId) : [];
  const doneProjects = linkedProjects.filter(p => p.status === "done").length;
  const progress = linkedProjects.length > 0
    ? Math.round((doneProjects / linkedProjects.length) * 100)
    : goal?.progress || 0;

  return (
    <Sheet open={!!goalId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[1100px] p-0 overflow-hidden flex flex-col">
        {loading || !goal ? (
          <div className="flex items-center gap-2 px-6 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading goal…
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left main column */}
            <div className="flex-1 min-w-0 flex flex-col overflow-y-auto">
              {/* Header */}
              <div className="px-6 py-5 border-b border-border/40 shrink-0 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Target className="h-3.5 w-3.5 text-primary/70" />
                    <span className="font-medium">Goal</span>
                    <span className="text-muted-foreground/40">·</span>
                    <Select value={goal.quarter ?? "Q2"} onValueChange={v => update({ quarter: v })}>
                      <SelectTrigger className="h-auto border-none shadow-none p-0 gap-0.5 focus:ring-0 w-auto text-xs font-medium [&>svg]:h-3 [&>svg]:w-3">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Q1","Q2","Q3","Q4"].map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={String(goal.year ?? new Date().getFullYear())} onValueChange={v => update({ year: parseInt(v) })}>
                      <SelectTrigger className="h-auto border-none shadow-none p-0 gap-0.5 focus:ring-0 w-auto text-xs font-medium [&>svg]:h-3 [&>svg]:w-3">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2025,2026,2027,2028].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
                        aria-label="More actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        onClick={handleDeleteGoal}
                        className="text-destructive focus:text-destructive flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete Goal
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <input
                  value={goal.title}
                  onChange={e => setGoal((g: any) => ({ ...g, title: e.target.value }))}
                  onBlur={e => update({ title: e.target.value.trim() || goal.title })}
                  className="text-xl font-bold bg-transparent outline-none w-full"
                />

                <input
                  value={goal.description || ""}
                  onChange={e => setGoal((g: any) => ({ ...g, description: e.target.value }))}
                  onBlur={e => update({ description: e.target.value })}
                  placeholder="Add a short description..."
                  className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground/40"
                />

                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={goal.status} onValueChange={v => update({ status: v })}>
                    <SelectTrigger className="h-auto border-none shadow-none p-0 gap-1 focus:ring-0 w-auto [&>svg:last-child]:hidden">
                      <StatusBadge
                        label={GOAL_STATUS_LABEL[goal.status] ?? goal.status}
                        variant={GOAL_STATUS_VARIANT[goal.status] ?? "default"}
                        dot
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {goalStatusOptions.map(s => (
                        <SelectItem key={s.value} value={s.value}>
                          <span className="flex items-center gap-2">
                            <StatusBadge label={s.label} variant={GOAL_STATUS_VARIANT[s.value] ?? "default"} dot />
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <OwnerPicker ownerId={goal.owner_id} onChange={id => update({ owner_id: id })} />
                  <FollowersPicker
                    followerIds={Array.isArray(goal.followers) ? goal.followers : []}
                    ownerId={goal.owner_id}
                    onChange={ids => update({ followers: ids })}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-5">
                {/* Key Results */}
                <Collapsible open={krsOpen} onOpenChange={setKrsOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-semibold text-foreground/80 hover:text-foreground py-1">
                    {krsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
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
                        <button
                          onClick={() => removeKr(i)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" onClick={addKr} className="h-7 text-xs text-muted-foreground">
                      <Plus className="h-3 w-3 mr-1" /> Add key result
                    </Button>
                  </CollapsibleContent>
                </Collapsible>

                {/* Linked Projects */}
                <Collapsible open={projectsOpen} onOpenChange={setProjectsOpen}>
                  <div className="flex items-center justify-between">
                    <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-foreground/80 hover:text-foreground py-1">
                      {projectsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      <FolderKanban className="h-3.5 w-3.5" /> Key Projects
                      <span className="text-[11px] font-normal text-muted-foreground ml-1">({linkedProjects.length})</span>
                    </CollapsibleTrigger>
                    <LinkProjectPicker goalId={goalId!} allProjects={allProjects} onLinked={() => { onChanged(); fetchGoal(); }} />
                  </div>
                  <CollapsibleContent className="pt-3 space-y-1.5">
                    {linkedProjects.map(p => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/30 hover:bg-muted/60 cursor-pointer group transition-colors"
                        onClick={() => onOpenProject(p.id)}
                      >
                        <StatusBadge
                          label={PROJECT_STATUS_LABEL[p.status] ?? p.status}
                          variant={PROJECT_STATUS_VARIANT[p.status] ?? "default"}
                          size="xs"
                        />
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

                {/* Strategy & Notes */}
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80 py-1">
                    <FileText className="h-3.5 w-3.5" /> Strategy & Notes
                  </div>
                  <div className="pt-2">
                    <RichTextEditor
                      content={goal.alignment_notes || ""}
                      onChange={html => update({ alignment_notes: html })}
                      placeholder="Strategy, context, alignment notes..."
                      borderless
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right rail — Activity */}
            <aside className="w-[400px] shrink-0 border-l border-border/40 bg-card/30 flex flex-col overflow-hidden">
              <div className="px-4 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground shrink-0 border-b border-border/40">
                Activity · Comments
              </div>
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col px-2 py-2">
                <ActivityPanel entityType="goal" entityId={goalId!} hideHeader />
              </div>
            </aside>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
