// ProcessLandingGrid — the new landing for /process-map.
//
// Replaces the small ReactFlow node landing with a grid of large interactive
// cards (one per top-level function/dept). Click a card → drill into that
// function's subprocess flow.
//
// Below the grid: a global "Process Improvements" inbox where the team can
// drop ideas / pain points / observations / improvements tied to a specific
// function. Each improvement can be promoted to a task or project.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  FolderTree, ChevronRight, ListChecks, MessageSquare, Loader2,
  Lightbulb, AlertTriangle, Eye, ArrowUpCircle, Plus, Trash2, ListTodo, FolderPlus, Check,
} from "lucide-react";
import { toast } from "sonner";
import { appConfirm } from "@/components/AppConfirm";
import type { ProcessBucket } from "@/lib/processMap";
import { cn } from "@/lib/utils";

const sb = supabase as any;

type ImprovementKind = "idea" | "pain_point" | "observation" | "improvement";
type ImprovementStatus = "open" | "in_review" | "converted" | "closed";

type Improvement = {
  id: string;
  bucket_id: string | null;
  title: string;
  description: string;
  status: ImprovementStatus;
  kind: ImprovementKind;
  created_at: string;
};

const KIND_TONE: Record<ImprovementKind, { label: string; cls: string; icon: React.ElementType }> = {
  idea:        { label: "Idea",        cls: "bg-purple-500/10 text-purple-700 dark:text-purple-300 ring-purple-500/20", icon: Lightbulb },
  pain_point:  { label: "Pain Point",  cls: "bg-red-500/10 text-red-700 dark:text-red-300 ring-red-500/20", icon: AlertTriangle },
  observation: { label: "Observation", cls: "bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-500/20", icon: Eye },
  improvement: { label: "Improvement", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20", icon: ArrowUpCircle },
};

interface Props {
  areas: ProcessBucket[];
  bucketCounts: Record<string, { children: number; steps: number; projects: number }>;
  onOpenArea: (b: ProcessBucket) => void;
}

export function ProcessLandingGrid({ areas, bucketCounts, onOpenArea }: Props) {
  const { user } = useAuth();
  const [improvements, setImprovements] = useState<Improvement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBucketId, setFilterBucketId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newKind, setNewKind] = useState<ImprovementKind>("idea");
  const [newBucketId, setNewBucketId] = useState<string>("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await sb
      .from("process_improvements")
      .select("*")
      .order("created_at", { ascending: false });
    setImprovements(((data ?? []) as Improvement[]));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addImprovement = async () => {
    if (!newTitle.trim() || !user) return;
    setAdding(true);
    const { data, error } = await sb.from("process_improvements").insert({
      bucket_id: newBucketId || null,
      title: newTitle.trim(),
      kind: newKind,
      status: "open",
      created_by: user.id,
    }).select().single();
    setAdding(false);
    if (error) { toast.error(error.message); return; }
    if (data) setImprovements((prev) => [data as Improvement, ...prev]);
    setNewTitle("");
  };

  const setStatus = async (id: string, status: ImprovementStatus) => {
    setImprovements((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
    await sb.from("process_improvements").update({ status }).eq("id", id);
  };

  const promoteToTask = async (imp: Improvement) => {
    if (!user) return;
    const { data: task, error } = await sb.from("tasks").insert({
      title: imp.title,
      description: imp.description || `From Process Map improvement (${KIND_TONE[imp.kind].label})`,
      status: "todo",
      priority: "medium",
      created_by: user.id,
      assigned_to: user.id,
    }).select("id").single();
    if (error || !task) { toast.error(error?.message || "Couldn't create task"); return; }
    await sb.from("process_improvements").update({
      converted_to_task_id: task.id,
      status: "converted",
    }).eq("id", imp.id);
    setImprovements((prev) => prev.map((i) => i.id === imp.id ? { ...i, status: "converted" } : i));
    toast.success("Task created");
  };

  const promoteToProject = async (imp: Improvement) => {
    if (!user) return;
    if (!(await appConfirm({ title: "Convert to project?", body: imp.title, confirmLabel: "Convert" }))) return;
    const { data: proj, error } = await sb.from("projects").insert({
      title: imp.title,
      description: imp.description || `Converted from Process Map (${KIND_TONE[imp.kind].label})`,
      owner_id: user.id,
      created_by: user.id,
    }).select("id").single();
    if (error || !proj) { toast.error(error?.message || "Couldn't create project"); return; }
    await sb.from("process_improvements").update({
      converted_to_project_id: proj.id,
      status: "converted",
    }).eq("id", imp.id);
    setImprovements((prev) => prev.map((i) => i.id === imp.id ? { ...i, status: "converted" } : i));
    toast.success("Project created");
  };

  const remove = async (id: string) => {
    if (!(await appConfirm({ title: "Delete this improvement?", confirmLabel: "Delete", destructive: true }))) return;
    setImprovements((prev) => prev.filter((i) => i.id !== id));
    await sb.from("process_improvements").delete().eq("id", id);
  };

  const visibleImprovements = useMemo(() => {
    if (!filterBucketId) return improvements;
    return improvements.filter((i) => i.bucket_id === filterBucketId);
  }, [improvements, filterBucketId]);

  const bucketNameFor = (id: string | null) => {
    if (!id) return "Unassigned";
    return areas.find((a) => a.id === id)?.name ?? "—";
  };

  return (
    <div className="px-6 py-6 max-w-[1500px] mx-auto space-y-10">
      {/* Function cards */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FolderTree className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Functions</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {areas.length === 0 ? (
            <p className="text-sm text-muted-foreground/70 italic">No functions yet. Add one in the canvas.</p>
          ) : (
            areas.map((a) => {
              const counts = bucketCounts[a.id] ?? { children: 0, steps: 0, projects: 0 };
              return (
                <button
                  key={a.id}
                  onClick={() => onOpenArea(a)}
                  className="text-left rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:shadow-md transition-all p-5 group"
                  style={{ borderTop: `4px solid ${a.color}` }}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-lg font-bold text-foreground">{a.name}</h3>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                  </div>
                  {a.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{a.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <FolderTree className="h-3 w-3" /> {counts.children} {counts.children === 1 ? "node" : "nodes"}
                    </span>
                    {counts.steps > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <ListChecks className="h-3 w-3" /> {counts.steps} steps
                      </span>
                    )}
                    {counts.projects > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <FolderPlus className="h-3 w-3" /> {counts.projects} projects
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* Improvements inbox */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Improvements</h2>
          <span className="text-[11px] text-muted-foreground/70">— ideas, pain points, observations & improvements tied to processes</span>
        </div>

        {/* Add row */}
        <div className="rounded-xl border border-border/60 bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as ImprovementKind)}
              className="text-xs bg-muted/40 border border-border/40 rounded-md px-2 py-1.5 outline-none"
            >
              {(["idea","pain_point","observation","improvement"] as ImprovementKind[]).map((k) => (
                <option key={k} value={k}>{KIND_TONE[k].label}</option>
              ))}
            </select>
            <select
              value={newBucketId}
              onChange={(e) => setNewBucketId(e.target.value)}
              className="text-xs bg-muted/40 border border-border/40 rounded-md px-2 py-1.5 outline-none"
            >
              <option value="">Unassigned</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addImprovement(); }}
              placeholder="Drop an idea, pain point, observation…"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/50"
            />
            <button
              onClick={addImprovement}
              disabled={adding || !newTitle.trim()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-primary text-primary-foreground disabled:opacity-40"
            >
              {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Add
            </button>
          </div>
        </div>

        {/* Filter chips */}
        {areas.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterBucketId(null)}
              className={cn(
                "text-[11px] px-2 py-0.5 rounded-full border transition-colors",
                filterBucketId === null ? "bg-primary text-primary-foreground border-primary" : "border-border/40 text-muted-foreground hover:text-foreground",
              )}
            >
              All
            </button>
            {areas.map((a) => (
              <button
                key={a.id}
                onClick={() => setFilterBucketId(a.id === filterBucketId ? null : a.id)}
                className={cn(
                  "text-[11px] px-2 py-0.5 rounded-full border transition-colors",
                  filterBucketId === a.id ? "border-primary text-primary" : "border-border/40 text-muted-foreground hover:text-foreground",
                )}
                style={{ borderColor: filterBucketId === a.id ? a.color : undefined }}
              >
                {a.name}
              </button>
            ))}
          </div>
        )}

        {/* List */}
        {loading ? (
          <p className="text-xs text-muted-foreground/60 italic py-4">Loading…</p>
        ) : visibleImprovements.length === 0 ? (
          <div className="text-center py-8 rounded-xl border border-dashed border-border/40">
            <p className="text-sm text-muted-foreground/70">No improvements yet. Drop the first one above.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {visibleImprovements.map((imp) => {
              const tone = KIND_TONE[imp.kind];
              const Icon = tone.icon;
              const converted = imp.status === "converted";
              const closed = imp.status === "closed";
              return (
                <li
                  key={imp.id}
                  className={cn(
                    "group rounded-lg border border-border/40 bg-card/40 p-3 flex items-start gap-3 hover:border-border/80 transition-colors",
                    (converted || closed) && "opacity-60",
                  )}
                >
                  <span className={cn("inline-flex items-center gap-1 ring-1 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 mt-0.5", tone.cls)}>
                    <Icon className="h-2.5 w-2.5" />
                    {tone.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm text-foreground", closed && "line-through")}>{imp.title}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {bucketNameFor(imp.bucket_id)} · {imp.status}
                    </p>
                  </div>
                  {!converted && !closed && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => promoteToTask(imp)}
                        className="inline-flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                        title="Create task"
                      >
                        <ListTodo className="h-3 w-3" /> Task
                      </button>
                      <button
                        onClick={() => promoteToProject(imp)}
                        className="inline-flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-medium bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20"
                        title="Convert to project"
                      >
                        <FolderPlus className="h-3 w-3" /> Project
                      </button>
                      <button
                        onClick={() => setStatus(imp.id, "closed")}
                        className="inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                        title="Close"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => remove(imp.id)}
                        className="inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
