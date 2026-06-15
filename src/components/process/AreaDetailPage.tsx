// AreaDetailPage — the default view when drilling into an area.
// Shows the function as a readable page: header, ordered process steps,
// playbook docs, area connections, and scoped improvements.
// The Map/canvas view is a toggle at the toolbar level, not here.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ChevronUp, ChevronDown, Plus, Trash2, Save, FileText,
  ArrowRight, ArrowLeft, X, Loader2, Check, Lightbulb,
  AlertTriangle, Eye, ArrowUpCircle, ListTodo, FolderPlus,
  Pencil, Link2,
} from "lucide-react";
import { toast } from "sonner";
import { appConfirm } from "@/components/AppConfirm";
import { cn } from "@/lib/utils";
import {
  ProcessBucket,
  ProcessVertical,
  LinkedDoc,
  createBucket,
  updateBucket,
  deleteBucket,
  getProcessBuckets,
  getLinkedDocs,
  getAreaConnections,
  createEdge,
  deleteEdge,
} from "@/lib/processMap";

const sb = supabase as any;

// ── Constants ──────────────────────────────────────────────

const NODE_TYPE_OPTIONS = ["source", "process", "decision", "outcome"] as const;
type NodeType = typeof NODE_TYPE_OPTIONS[number];

const NODE_TYPE_STYLE: Record<NodeType, { label: string; cls: string }> = {
  source:   { label: "Source",   cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" },
  process:  { label: "Process",  cls: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20" },
  decision: { label: "Decision", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20" },
  outcome:  { label: "Outcome",  cls: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20" },
};

// ── Types ──────────────────────────────────────────────────

type ImprovementKind = "idea" | "pain_point" | "observation" | "improvement";
type ImprovementStatus = "open" | "in_review" | "converted" | "closed";

type Improvement = {
  id: string;
  bucket_id: string | null;
  title: string;
  kind: ImprovementKind;
  status: ImprovementStatus;
  created_at: string;
};

const KIND_ICON: Record<ImprovementKind, React.ElementType> = {
  idea: Lightbulb, pain_point: AlertTriangle, observation: Eye, improvement: ArrowUpCircle,
};
const KIND_CLS: Record<ImprovementKind, string> = {
  idea: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  pain_point: "bg-red-500/10 text-red-700 dark:text-red-300",
  observation: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  improvement: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

// ── Step card ──────────────────────────────────────────────

function StepCard({
  step, index, total, onMoveUp, onMoveDown, onDelete, onUpdate,
}: {
  step: ProcessBucket;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<ProcessBucket>) => void;
}) {
  const [editName, setEditName]   = useState(step.name);
  const [editDesc, setEditDesc]   = useState(step.description ?? "");
  const [nameChanged, setNameChanged] = useState(false);
  const [descChanged, setDescChanged] = useState(false);
  const [expanded, setExpanded]   = useState(false);

  const saveName = async () => {
    if (!nameChanged || !editName.trim()) return;
    await updateBucket(step.id, { name: editName.trim() });
    onUpdate({ name: editName.trim() });
    setNameChanged(false);
  };
  const saveDesc = async () => {
    if (!descChanged) return;
    await updateBucket(step.id, { description: editDesc || null });
    onUpdate({ description: editDesc || null });
    setDescChanged(false);
  };
  const setType = async (t: NodeType) => {
    await updateBucket(step.id, { node_type: t });
    onUpdate({ node_type: t });
  };

  const typeMeta = NODE_TYPE_STYLE[step.node_type as NodeType] ?? NODE_TYPE_STYLE.process;

  return (
    <div className={cn(
      "group rounded-xl border border-border/50 bg-card transition-all",
      expanded ? "border-primary/30 shadow-sm" : "hover:border-border/80",
    )}>
      <div className="flex items-start gap-3 p-4">
        {/* Step number */}
        <div
          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5"
          style={{ background: step.color || "#6366f1" }}
        >
          {index + 1}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {/* Type selector */}
            <div className="relative group/type">
              <span className={cn(
                "inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wide cursor-pointer select-none",
                typeMeta.cls,
              )}>
                {typeMeta.label}
              </span>
              <div className="absolute top-full left-0 mt-1 z-10 hidden group-hover/type:flex flex-col bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                {NODE_TYPE_OPTIONS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={cn(
                      "px-3 py-1.5 text-xs text-left hover:bg-muted/50 transition-colors capitalize",
                      step.node_type === t && "font-semibold",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Name */}
          <input
            value={editName}
            onChange={(e) => { setEditName(e.target.value); setNameChanged(true); }}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            onClick={() => setExpanded(true)}
            className="w-full bg-transparent font-semibold text-sm text-foreground outline-none border-b border-transparent hover:border-border/40 focus:border-primary/40 pb-0.5 transition-colors"
            placeholder="Step name"
          />

          {/* Description — shown when expanded */}
          {expanded && (
            <textarea
              value={editDesc}
              onChange={(e) => { setEditDesc(e.target.value); setDescChanged(true); }}
              onBlur={saveDesc}
              placeholder="Add a description for this step…"
              rows={2}
              className="mt-2 w-full bg-transparent text-xs text-muted-foreground outline-none border-b border-transparent hover:border-border/30 focus:border-primary/30 resize-none transition-colors placeholder:text-muted-foreground/40"
            />
          )}
          {!expanded && step.description && (
            <p className="mt-1 text-xs text-muted-foreground/70 line-clamp-1">{step.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onMoveUp} disabled={index === 0} className="p-1 rounded hover:bg-muted text-muted-foreground/60 hover:text-foreground disabled:opacity-20" title="Move up">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={onMoveDown} disabled={index === total - 1} className="p-1 rounded hover:bg-muted text-muted-foreground/60 hover:text-foreground disabled:opacity-20" title="Move down">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setExpanded((v) => !v)} className="p-1 rounded hover:bg-muted text-muted-foreground/60 hover:text-foreground" title="Expand">
            <Pencil className="h-3 w-3" />
          </button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground/60 hover:text-destructive" title="Delete step">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────

interface Props {
  area: ProcessBucket;
  vertical: ProcessVertical | null;
  allAreas: ProcessBucket[];
  workspaceId: string;
  onAreaUpdated: (patch: Partial<ProcessBucket>) => void;
}

export function AreaDetailPage({ area, vertical, allAreas, workspaceId, onAreaUpdated }: Props) {
  const { user } = useAuth();

  // Header edit
  const [editName, setEditName]   = useState(area.name);
  const [editDesc, setEditDesc]   = useState(area.description ?? "");
  const [nameChanged, setNameChanged] = useState(false);
  const [descChanged, setDescChanged] = useState(false);

  // Process steps
  const [steps, setSteps]       = useState<ProcessBucket[]>([]);
  const [stepsLoading, setStepsLoading] = useState(true);

  // Add step
  const [addingStep, setAddingStep] = useState(false);
  const [newStepName, setNewStepName]   = useState("");
  const [newStepType, setNewStepType]   = useState<NodeType>("process");
  const [savingStep, setSavingStep] = useState(false);

  // Docs
  const [docs, setDocs]         = useState<LinkedDoc[]>([]);
  const [docSearch, setDocSearch] = useState("");
  const [docResults, setDocResults] = useState<{ id: string; title: string; icon: string | null; tags: string[] }[]>([]);
  const [docSearching, setDocSearching] = useState(false);
  const [linkingDocId, setLinkingDocId] = useState<string | null>(null);

  // Connections
  const [incoming, setIncoming] = useState<ProcessBucket[]>([]);
  const [outgoing, setOutgoing] = useState<ProcessBucket[]>([]);
  const [addingConn, setAddingConn] = useState<"in" | "out" | null>(null);
  const [savingConn, setSavingConn] = useState(false);

  // Improvements
  const [improvements, setImprovements] = useState<Improvement[]>([]);
  const [newImpTitle, setNewImpTitle] = useState("");
  const [newImpKind, setNewImpKind]   = useState<ImprovementKind>("idea");
  const [addingImp, setAddingImp]     = useState(false);

  // ── Load ──────────────────────────────────────────────────

  useEffect(() => {
    setEditName(area.name);
    setEditDesc(area.description ?? "");
    setNameChanged(false);
    setDescChanged(false);

    const load = async () => {
      setStepsLoading(true);
      const [subBuckets, linkedDocs, connections, impRows] = await Promise.all([
        getProcessBuckets(area.id),
        getLinkedDocs(area.slug),
        getAreaConnections(area.id),
        sb.from("process_improvements").select("*")
          .eq("bucket_id", area.id)
          .order("created_at", { ascending: false }),
      ]);
      setSteps(subBuckets);
      setDocs(linkedDocs);
      setIncoming(connections.incoming);
      setOutgoing(connections.outgoing);
      setImprovements(impRows.data ?? []);
      setStepsLoading(false);
    };
    load();
  }, [area.id, area.slug]);

  // ── Header save ───────────────────────────────────────────

  const saveName = async () => {
    if (!nameChanged || !editName.trim()) return;
    await updateBucket(area.id, { name: editName.trim() });
    onAreaUpdated({ name: editName.trim() });
    setNameChanged(false);
  };
  const saveDesc = async () => {
    if (!descChanged) return;
    await updateBucket(area.id, { description: editDesc || null });
    onAreaUpdated({ description: editDesc || null });
    setDescChanged(false);
  };

  // ── Steps ──────────────────────────────────────────────────

  const moveStep = async (index: number, dir: "up" | "down") => {
    const newSteps = [...steps];
    const target = dir === "up" ? index - 1 : index + 1;
    [newSteps[index], newSteps[target]] = [newSteps[target], newSteps[index]];
    // reassign bucket_order
    const updates = newSteps.map((s, i) => ({ ...s, bucket_order: i + 1 }));
    setSteps(updates);
    await Promise.all(updates.map((s) => updateBucket(s.id, { bucket_order: s.bucket_order })));
  };

  const deleteStep = async (id: string) => {
    if (!(await appConfirm({ title: "Delete this step?", confirmLabel: "Delete", destructive: true }))) return;
    await deleteBucket(id);
    setSteps((prev) => prev.filter((s) => s.id !== id));
  };

  const addStep = async () => {
    if (!newStepName.trim()) return;
    setSavingStep(true);
    try {
      const bucket = await createBucket(
        workspaceId,
        newStepName.trim(),
        area.id,
        { x: 0, y: steps.length * 180 },
        steps.length,
        null,
        newStepType,
      );
      setSteps((prev) => [...prev, bucket]);
      setNewStepName("");
      setNewStepType("process");
      setAddingStep(false);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSavingStep(false);
    }
  };

  // ── Docs ───────────────────────────────────────────────────

  const searchDocs = useCallback(async (q: string) => {
    if (!q.trim()) { setDocResults([]); return; }
    setDocSearching(true);
    const { data } = await sb.from("documents").select("id, title, icon, tags").ilike("title", `%${q}%`).limit(8);
    setDocResults(data ?? []);
    setDocSearching(false);
  }, []);

  const linkDoc = async (doc: { id: string; title: string; icon: string | null; tags: string[] }) => {
    setLinkingDocId(doc.id);
    const newTags = Array.from(new Set([...(doc.tags ?? []), area.slug]));
    await sb.from("documents").update({ tags: newTags }).eq("id", doc.id);
    setDocs((prev) => [...prev, { id: doc.id, title: doc.title, updated_at: new Date().toISOString(), icon: doc.icon }]);
    setDocSearch(""); setDocResults([]); setLinkingDocId(null);
  };

  const unlinkDoc = async (doc: LinkedDoc) => {
    const { data } = await sb.from("documents").select("tags").eq("id", doc.id).single();
    const newTags = ((data?.tags ?? []) as string[]).filter((t: string) => t !== area.slug);
    await sb.from("documents").update({ tags: newTags }).eq("id", doc.id);
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
  };

  // ── Connections ────────────────────────────────────────────

  const connectableAreas = allAreas.filter(
    (a) => a.id !== area.id && ![...incoming, ...outgoing].find((c) => c.id === a.id),
  );

  const addConnection = async (targetArea: ProcessBucket, dir: "in" | "out") => {
    setSavingConn(true);
    try {
      if (dir === "out") {
        await createEdge(area.id, targetArea.id);
        setOutgoing((prev) => [...prev, targetArea]);
      } else {
        await createEdge(targetArea.id, area.id);
        setIncoming((prev) => [...prev, targetArea]);
      }
      setAddingConn(null);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSavingConn(false);
    }
  };

  const removeConnection = async (connected: ProcessBucket, dir: "in" | "out") => {
    if (dir === "out") {
      await deleteEdge(area.id, connected.id);
      setOutgoing((prev) => prev.filter((a) => a.id !== connected.id));
    } else {
      await deleteEdge(connected.id, area.id);
      setIncoming((prev) => prev.filter((a) => a.id !== connected.id));
    }
  };

  // ── Improvements ───────────────────────────────────────────

  const addImprovement = async () => {
    if (!newImpTitle.trim() || !user) return;
    setAddingImp(true);
    const { data, error } = await sb.from("process_improvements").insert({
      bucket_id: area.id,
      title: newImpTitle.trim(),
      kind: newImpKind,
      status: "open",
      created_by: user.id,
    }).select().single();
    setAddingImp(false);
    if (error) { toast.error(error.message); return; }
    if (data) setImprovements((prev) => [data, ...prev]);
    setNewImpTitle("");
  };

  const closeImprovement = async (id: string) => {
    setImprovements((prev) => prev.map((i) => i.id === id ? { ...i, status: "closed" } : i));
    await sb.from("process_improvements").update({ status: "closed" }).eq("id", id);
  };

  const promoteImpToTask = async (imp: Improvement) => {
    if (!user) return;
    const { data: task, error } = await sb.from("tasks").insert({
      title: imp.title,
      status: "todo",
      priority: "medium",
      created_by: user.id,
      assigned_to: user.id,
    }).select("id").single();
    if (error || !task) { toast.error(error?.message || "Failed"); return; }
    await sb.from("process_improvements").update({ converted_to_task_id: task.id, status: "converted" }).eq("id", imp.id);
    setImprovements((prev) => prev.map((i) => i.id === imp.id ? { ...i, status: "converted" } : i));
    toast.success("Task created");
  };

  // ── Render ─────────────────────────────────────────────────

  const openImprovements = improvements.filter((i) => i.status === "open" || i.status === "in_review");

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-10">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="space-y-3">
        {vertical && (
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
              style={{ background: vertical.color }}
            >
              {vertical.name}
            </span>
          </div>
        )}

        <div className="space-y-1">
          <input
            value={editName}
            onChange={(e) => { setEditName(e.target.value); setNameChanged(true); }}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            className="w-full text-3xl font-bold text-foreground bg-transparent outline-none border-b-2 border-transparent hover:border-border/40 focus:border-primary/50 pb-1 transition-colors"
            placeholder="Area name"
          />
          <textarea
            value={editDesc}
            onChange={(e) => { setEditDesc(e.target.value); setDescChanged(true); }}
            onBlur={saveDesc}
            rows={2}
            placeholder="Describe what this function does and why it matters…"
            className="w-full text-base text-muted-foreground bg-transparent outline-none border-b border-transparent hover:border-border/30 focus:border-primary/30 resize-none transition-colors placeholder:text-muted-foreground/30 leading-relaxed"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground/60 pt-1">
          <span>{steps.length} {steps.length === 1 ? "step" : "steps"}</span>
          {docs.length > 0 && <><span>·</span><span>{docs.length} {docs.length === 1 ? "doc" : "docs"}</span></>}
          {openImprovements.length > 0 && <><span>·</span><span className="text-amber-600">{openImprovements.length} open {openImprovements.length === 1 ? "issue" : "issues"}</span></>}
        </div>
      </div>

      {/* ── Process steps ──────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Process</h2>
          <div className="flex-1 h-px bg-border/40" />
          {!addingStep && (
            <button
              onClick={() => setAddingStep(true)}
              className="text-[11px] text-muted-foreground/60 hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <Plus className="h-3 w-3" /> Add step
            </button>
          )}
        </div>

        {stepsLoading ? (
          <p className="text-sm text-muted-foreground/50 italic py-4">Loading…</p>
        ) : (
          <div className="space-y-2">
            {steps.length === 0 && !addingStep && (
              <div
                className="rounded-xl border-2 border-dashed border-border/40 p-8 text-center cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => setAddingStep(true)}
              >
                <Plus className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground/50">Add your first process step</p>
              </div>
            )}

            {steps.map((step, i) => (
              <StepCard
                key={step.id}
                step={step}
                index={i}
                total={steps.length}
                onMoveUp={() => moveStep(i, "up")}
                onMoveDown={() => moveStep(i, "down")}
                onDelete={() => deleteStep(step.id)}
                onUpdate={(patch) => setSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, ...patch } : s))}
              />
            ))}

            {/* Add step form */}
            {addingStep && (
              <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex gap-2">
                  {NODE_TYPE_OPTIONS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setNewStepType(t)}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-medium border transition-all capitalize",
                        newStepType === t
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/40 text-muted-foreground hover:border-border",
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <input
                  autoFocus
                  value={newStepName}
                  onChange={(e) => setNewStepName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addStep(); if (e.key === "Escape") { setAddingStep(false); setNewStepName(""); } }}
                  placeholder="Step name…"
                  className="w-full bg-transparent text-sm font-medium outline-none border-b border-border/40 focus:border-primary/40 pb-1 transition-colors"
                />
                <div className="flex gap-2">
                  <button
                    onClick={addStep}
                    disabled={!newStepName.trim() || savingStep}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground disabled:opacity-40"
                  >
                    {savingStep ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Add step
                  </button>
                  <button
                    onClick={() => { setAddingStep(false); setNewStepName(""); }}
                    className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Connections ────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Connections</h2>
          <div className="flex-1 h-px bg-border/40" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Receives from */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground/60 flex items-center gap-1.5">
              <ArrowLeft className="h-3 w-3" /> Receives from
            </p>
            <div className="space-y-1.5">
              {incoming.map((a) => (
                <div key={a.id} className="group flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/40 bg-card text-xs">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: a.color }} />
                  <span className="flex-1 font-medium truncate">{a.name}</span>
                  <button onClick={() => removeConnection(a, "in")} className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-red-400">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {addingConn === "in" ? (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 space-y-1">
                  {connectableAreas.length === 0
                    ? <p className="text-[11px] text-muted-foreground/50 italic">No other areas to connect</p>
                    : connectableAreas.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => addConnection(a, "in")}
                          disabled={savingConn}
                          className="w-full text-left flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-muted/50 transition-colors"
                        >
                          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: a.color }} />
                          {a.name}
                        </button>
                      ))
                  }
                  <button onClick={() => setAddingConn(null)} className="text-[11px] text-muted-foreground/50 hover:text-foreground mt-1">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setAddingConn("in")} className="text-[11px] text-muted-foreground/40 hover:text-foreground flex items-center gap-1 transition-colors">
                  <Plus className="h-3 w-3" /> Add
                </button>
              )}
            </div>
          </div>

          {/* Passes to */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground/60 flex items-center gap-1.5">
              <ArrowRight className="h-3 w-3" /> Passes to
            </p>
            <div className="space-y-1.5">
              {outgoing.map((a) => (
                <div key={a.id} className="group flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/40 bg-card text-xs">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: a.color }} />
                  <span className="flex-1 font-medium truncate">{a.name}</span>
                  <button onClick={() => removeConnection(a, "out")} className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-red-400">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {addingConn === "out" ? (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 space-y-1">
                  {connectableAreas.length === 0
                    ? <p className="text-[11px] text-muted-foreground/50 italic">No other areas to connect</p>
                    : connectableAreas.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => addConnection(a, "out")}
                          disabled={savingConn}
                          className="w-full text-left flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-muted/50 transition-colors"
                        >
                          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: a.color }} />
                          {a.name}
                        </button>
                      ))
                  }
                  <button onClick={() => setAddingConn(null)} className="text-[11px] text-muted-foreground/50 hover:text-foreground mt-1">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setAddingConn("out")} className="text-[11px] text-muted-foreground/40 hover:text-foreground flex items-center gap-1 transition-colors">
                  <Plus className="h-3 w-3" /> Add
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Playbook docs ───────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Playbook</h2>
          <div className="flex-1 h-px bg-border/40" />
        </div>

        <div className="space-y-1.5">
          {docs.map((doc) => (
            <div key={doc.id} className="group flex items-center gap-3 px-3 py-2 rounded-lg border border-border/40 bg-card hover:border-border/70 transition-colors">
              <span className="text-base shrink-0">{doc.icon ?? "📄"}</span>
              <span className="flex-1 text-sm font-medium text-foreground truncate">{doc.title}</span>
              <button onClick={() => unlinkDoc(doc)} className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-red-400 transition-opacity shrink-0" title="Unlink">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {docs.length === 0 && (
            <p className="text-sm text-muted-foreground/40 italic px-1">No linked docs yet — search below to connect a playbook or SOP</p>
          )}

          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
            <input
              value={docSearch}
              onChange={(e) => { setDocSearch(e.target.value); searchDocs(e.target.value); }}
              placeholder="Search docs to link…"
              className="w-full pl-8 pr-4 py-2 text-sm rounded-lg border border-border/40 bg-background outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
            />
            {docSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 animate-spin" />}
          </div>

          {docResults.length > 0 && (
            <div className="rounded-lg border border-border/60 bg-background shadow-sm overflow-hidden divide-y divide-border/30">
              {docResults.map((doc) => {
                const alreadyLinked = docs.some((d) => d.id === doc.id);
                return (
                  <button
                    key={doc.id}
                    onClick={() => !alreadyLinked && linkDoc(doc)}
                    disabled={linkingDocId === doc.id || alreadyLinked}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40 disabled:opacity-60 transition-colors"
                  >
                    <span>{doc.icon ?? "📄"}</span>
                    <span className="flex-1 truncate">{doc.title}</span>
                    {alreadyLinked && <span className="text-[10px] text-emerald-600 shrink-0">linked</span>}
                    {linkingDocId === doc.id && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Improvements ───────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Issues & Ideas</h2>
          <div className="flex-1 h-px bg-border/40" />
          {openImprovements.length > 0 && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
              {openImprovements.length} open
            </span>
          )}
        </div>

        {/* Add improvement */}
        <div className="flex items-center gap-2 p-3 rounded-xl border border-border/50 bg-card">
          <select
            value={newImpKind}
            onChange={(e) => setNewImpKind(e.target.value as ImprovementKind)}
            className="text-xs bg-muted/40 border border-border/40 rounded-md px-2 py-1.5 outline-none shrink-0"
          >
            <option value="idea">Idea</option>
            <option value="pain_point">Pain Point</option>
            <option value="observation">Observation</option>
            <option value="improvement">Improvement</option>
          </select>
          <input
            value={newImpTitle}
            onChange={(e) => setNewImpTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addImprovement(); }}
            placeholder="Flag an issue or idea for this area…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
          />
          <button
            onClick={addImprovement}
            disabled={addingImp || !newImpTitle.trim()}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground disabled:opacity-40"
          >
            {addingImp ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Add
          </button>
        </div>

        {improvements.length === 0 ? (
          <p className="text-sm text-muted-foreground/40 italic px-1">No issues or ideas logged yet</p>
        ) : (
          <div className="space-y-1.5">
            {improvements.map((imp) => {
              const Icon = KIND_ICON[imp.kind];
              const done = imp.status === "converted" || imp.status === "closed";
              return (
                <div
                  key={imp.id}
                  className={cn(
                    "group flex items-start gap-3 px-3 py-2.5 rounded-lg border border-border/40 bg-card hover:border-border/70 transition-colors",
                    done && "opacity-50",
                  )}
                >
                  <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0 mt-0.5", KIND_CLS[imp.kind])}>
                    <Icon className="h-2.5 w-2.5" />
                  </span>
                  <p className={cn("flex-1 text-sm text-foreground", done && "line-through")}>{imp.title}</p>
                  {!done && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => promoteImpToTask(imp)} className="p-1 rounded text-muted-foreground/50 hover:text-emerald-600 hover:bg-emerald-500/10" title="Create task">
                        <ListTodo className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => closeImprovement(imp.id)} className="p-1 rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted" title="Close">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
