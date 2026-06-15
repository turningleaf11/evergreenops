// AreaDetailPage — premium two-panel view for an OS Map area.
// Left: process steps (grouped rows, step owners, expand for step-level docs/description).
// Right: sticky sidebar — Playbook (area + all step docs, 2-way sync), Issues & Ideas.
// Click a step's open button → StepDetailSheet (rich text desc + sub-process canvas + docs).

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ChevronUp, ChevronDown, Plus, Trash2,
  X, Loader2, Check, Lightbulb,
  AlertTriangle, Eye, ArrowUpCircle, ListTodo, FolderOpen,
  Pencil, Link2, Layers, FileText, User, ExternalLink, GitBranch, MoreHorizontal,
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
  getChildCounts,
} from "@/lib/processMap";
import { StepDetailSheet } from "@/components/process/StepDetailSheet";

const sb = supabase as any;

// ── Types ──────────────────────────────────────────────────

const NODE_TYPE_OPTIONS = ["source", "process", "decision", "outcome"] as const;
type NodeType = typeof NODE_TYPE_OPTIONS[number];

const NODE_TYPE_STYLE: Record<NodeType, { label: string; cls: string; color: string }> = {
  source:   { label: "Source",   cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", color: "#10b981" },
  process:  { label: "Process",  cls: "bg-blue-500/10 text-blue-700 dark:text-blue-300",          color: "#3b82f6" },
  decision: { label: "Decision", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300",       color: "#f59e0b" },
  outcome:  { label: "Outcome",  cls: "bg-purple-500/10 text-purple-700 dark:text-purple-300",    color: "#8b5cf6" },
};

type ImprovementKind = "idea" | "pain_point" | "observation" | "improvement";
type ImprovementStatus = "open" | "in_review" | "converted" | "closed";

type Improvement = {
  id: string;
  bucket_id: string | null;
  step_id: string | null;
  title: string;
  kind: ImprovementKind;
  status: ImprovementStatus;
  created_at: string;
  created_by: string | null;
};

type Profile = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
};

const KIND_ICON: Record<ImprovementKind, React.ElementType> = {
  idea: Lightbulb, pain_point: AlertTriangle, observation: Eye, improvement: ArrowUpCircle,
};
const KIND_CLS: Record<ImprovementKind, string> = {
  idea:        "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  pain_point:  "bg-red-500/10 text-red-700 dark:text-red-300",
  observation: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  improvement: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

// ── Helpers ─────────────────────────────────────────────────

type StepRow = ProcessBucket | ProcessBucket[];

function groupSteps(steps: ProcessBucket[]): StepRow[] {
  const rows: StepRow[] = [];
  let i = 0;
  while (i < steps.length) {
    const step = steps[i];
    if (step.step_group) {
      const group: ProcessBucket[] = [step];
      while (i + 1 < steps.length && steps[i + 1].step_group === step.step_group) {
        i++;
        group.push(steps[i]);
      }
      rows.push(group);
    } else {
      rows.push(step);
    }
    i++;
  }
  return rows;
}

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

// ── StepCard ───────────────────────────────────────────────

function StepCard({
  step, flatIndex, total, inGroup, hasIssues,
  stepDocs, profiles, onOwnerChange,
  onMoveUp, onMoveDown, onDelete, onUpdate, onOpen,
  subNodeCount, openIssueCount,
}: {
  step: ProcessBucket;
  flatIndex: number;
  total: number;
  inGroup?: boolean;
  hasIssues?: boolean;
  stepDocs: LinkedDoc[];
  profiles: Profile[];
  onOwnerChange: (stepId: string, ownerId: string | null) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<ProcessBucket>) => void;
  onOpen: () => void;
  subNodeCount?: number;
  openIssueCount?: number;
}) {
  const [editName, setEditName]   = useState(step.name);
  const [nameChanged, setNameChanged] = useState(false);
  const [showMenu, setShowMenu]   = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setEditName(step.name); }, [step.name]);

  const saveName = async () => {
    if (!nameChanged || !editName.trim()) return;
    await updateBucket(step.id, { name: editName.trim() });
    onUpdate({ name: editName.trim() });
    setNameChanged(false);
  };

  const setType = async (t: NodeType) => {
    await updateBucket(step.id, { node_type: t });
    onUpdate({ node_type: t });
  };

  const owner = profiles.find((p) => p.user_id === step.owner_id);
  const typeMeta = NODE_TYPE_STYLE[step.node_type as NodeType] ?? NODE_TYPE_STYLE.process;

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-card transition-all duration-150 cursor-pointer",
        "border-border/40 hover:border-border/60 hover:shadow-lg hover:shadow-black/[0.06] hover:-translate-y-px",
        inGroup && "h-full flex flex-col",
      )}
      style={{ borderLeft: `3px solid ${typeMeta.color}` }}
      onClick={onOpen}
    >
      <div className="p-5 flex flex-col gap-0" style={inGroup ? { flex: 1 } : {}}>

        {/* Name + … */}
        <div className="flex items-start gap-3">
          <input
            value={editName}
            onChange={(e) => { setEditName(e.target.value); setNameChanged(true); }}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 bg-transparent text-[15px] font-semibold tracking-tight text-foreground outline-none placeholder:text-foreground/20 leading-snug"
            placeholder="Step name"
          />
          <div className="relative shrink-0" ref={menuRef} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-foreground/6 text-foreground/20 hover:text-foreground/60 opacity-0 group-hover:opacity-100 transition-all"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {showMenu && (
              <div
                className="absolute top-full right-0 mt-1.5 z-40 w-52 bg-popover border border-border/60 rounded-xl shadow-xl shadow-black/10 overflow-hidden py-1"
                onMouseLeave={() => setShowMenu(false)}
              >
                {/* Type */}
                <div className="px-3.5 pt-2 pb-2.5">
                  <p className="text-[10px] font-medium text-foreground/30 uppercase tracking-widest mb-2">Step type</p>
                  <div className="flex gap-2.5">
                    {NODE_TYPE_OPTIONS.map((t) => (
                      <button
                        key={t}
                        onClick={() => { setType(t); setShowMenu(false); }}
                        title={NODE_TYPE_STYLE[t].label}
                        className={cn(
                          "w-5 h-5 rounded-full transition-all hover:scale-110 ring-offset-2 ring-offset-popover",
                          step.node_type === t ? "ring-2" : "opacity-40 hover:opacity-80",
                        )}
                        style={{ background: NODE_TYPE_STYLE[t].color, ...(step.node_type === t ? { ringColor: NODE_TYPE_STYLE[t].color } : {}) }}
                      />
                    ))}
                  </div>
                </div>
                <div className="h-px bg-border/40 mx-3.5" />
                {/* Owner */}
                <div className="px-3.5 pt-2.5 pb-2">
                  <p className="text-[10px] font-medium text-foreground/30 uppercase tracking-widest mb-2">Owner</p>
                  <div className="space-y-0.5">
                    {profiles.map((p) => (
                      <button
                        key={p.user_id}
                        onClick={() => { onOwnerChange(step.id, p.user_id); setShowMenu(false); }}
                        className={cn(
                          "w-full text-left flex items-center gap-2.5 px-1 py-1 rounded-lg text-[13px] transition-colors",
                          step.owner_id === p.user_id ? "text-foreground font-medium bg-foreground/5" : "text-foreground/50 hover:text-foreground hover:bg-foreground/5",
                        )}
                      >
                        {p.avatar_url
                          ? <img src={p.avatar_url} className="w-5 h-5 rounded-full object-cover shrink-0" />
                          : <span className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[9px] font-bold shrink-0">{initials(p.full_name)}</span>
                        }
                        <span className="truncate">{p.full_name ?? p.user_id.slice(0, 8)}</span>
                        {step.owner_id === p.user_id && <Check className="h-3 w-3 ml-auto shrink-0 text-primary" />}
                      </button>
                    ))}
                    {step.owner_id && (
                      <button
                        onClick={() => { onOwnerChange(step.id, null); setShowMenu(false); }}
                        className="w-full text-left px-1 py-1 text-[12px] text-foreground/30 hover:text-foreground/60 transition-colors"
                      >
                        Remove owner
                      </button>
                    )}
                  </div>
                </div>
                <div className="h-px bg-border/40 mx-3.5" />
                {/* Reorder */}
                <div className="py-1">
                  <button
                    onClick={() => { onMoveUp(); setShowMenu(false); }}
                    disabled={flatIndex === 0}
                    className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-25"
                  >
                    <ChevronUp className="h-3.5 w-3.5" /> Move up
                  </button>
                  <button
                    onClick={() => { onMoveDown(); setShowMenu(false); }}
                    disabled={flatIndex === total - 1}
                    className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-25"
                  >
                    <ChevronDown className="h-3.5 w-3.5" /> Move down
                  </button>
                </div>
                <div className="h-px bg-border/40 mx-3.5" />
                <div className="py-1">
                  <button
                    onClick={() => { onDelete(); setShowMenu(false); }}
                    className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-destructive/70 hover:text-destructive hover:bg-destructive/8 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete step
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {step.description && (
          <p className="mt-2 text-[13px] text-foreground/45 leading-relaxed line-clamp-2">{step.description}</p>
        )}

        {/* Status signals */}
        {((subNodeCount ?? 0) > 0 || stepDocs.length > 0 || (openIssueCount ?? 0) > 0) && (
          <div className="mt-3.5 flex items-center gap-2 flex-wrap">
            {(subNodeCount ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground/40 bg-foreground/[0.04] border border-border/30 px-2.5 py-1 rounded-md">
                <GitBranch className="h-3 w-3" /> sub-process
              </span>
            )}
            {stepDocs.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground/40 bg-foreground/[0.04] border border-border/30 px-2.5 py-1 rounded-md max-w-[200px]">
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate">{stepDocs[0].title}</span>
                {stepDocs.length > 1 && <span className="shrink-0 text-foreground/25 ml-0.5">+{stepDocs.length - 1}</span>}
              </span>
            )}
            {(openIssueCount ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-500/70 bg-amber-500/[0.07] border border-amber-500/15 px-2.5 py-1 rounded-md">
                <AlertTriangle className="h-3 w-3" /> {openIssueCount} {openIssueCount === 1 ? "issue" : "issues"}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-3.5 border-t border-border/20 flex items-center gap-3">
          <span className="text-[11px] font-mono text-foreground/20">#{flatIndex + 1}</span>
          {hasIssues && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
          {owner && (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-foreground/40">
              {owner.avatar_url
                ? <img src={owner.avatar_url} className="w-4 h-4 rounded-full object-cover" />
                : <span className="w-4 h-4 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[8px] font-bold">{initials(owner.full_name)}</span>
              }
              {owner.full_name?.split(" ")[0]}
            </span>
          )}
          {step.step_group && (
            <span className="inline-flex items-center gap-1 text-[12px] text-foreground/30">
              <Layers className="h-3 w-3" /> {step.step_group}
            </span>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Sidebar section wrapper ────────────────────────────────

function SidebarSection({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/20">
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{title}</span>
        {badge && <span className="ml-auto">{badge}</span>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────

interface Props {
  area: ProcessBucket;
  vertical: ProcessVertical | null;
  allAreas: ProcessBucket[];
  workspaceId: string;
  onAreaUpdated: (patch: Partial<ProcessBucket>) => void;
}

export function AreaDetailPage({ area, vertical, allAreas, workspaceId, onAreaUpdated }: Props) {
  const { user } = useAuth();

  // Header
  const [editName, setEditName]       = useState(area.name);
  const [editDesc, setEditDesc]       = useState(area.description ?? "");
  const [nameChanged, setNameChanged] = useState(false);
  const [descChanged, setDescChanged] = useState(false);

  // Steps
  const [steps, setSteps]               = useState<ProcessBucket[]>([]);
  const [stepsLoading, setStepsLoading] = useState(true);
  const [addingStep, setAddingStep]     = useState(false);
  const [newStepName, setNewStepName]   = useState("");
  const [newStepType, setNewStepType]   = useState<NodeType>("process");
  const [savingStep, setSavingStep]     = useState(false);

  // Step docs — keyed by step.id (lifted for 2-way sidebar sync)
  const [stepDocsMap, setStepDocsMap] = useState<Record<string, LinkedDoc[]>>({});

  // Sub-process node counts per step
  const [subNodeCounts, setSubNodeCounts] = useState<Record<string, number>>({});

  // Area-level docs
  const [docs, setDocs]                 = useState<LinkedDoc[]>([]);
  const [docSearch, setDocSearch]       = useState("");
  const [docResults, setDocResults]     = useState<{ id: string; title: string; icon: string | null; tags: string[] }[]>([]);
  const [docSearching, setDocSearching] = useState(false);
  const [linkingDocId, setLinkingDocId] = useState<string | null>(null);

  // Improvements
  const [improvements, setImprovements] = useState<Improvement[]>([]);
  const [newImpTitle, setNewImpTitle]   = useState("");
  const [newImpKind, setNewImpKind]     = useState<ImprovementKind>("idea");
  const [newImpStepId, setNewImpStepId] = useState("");
  const [addingImp, setAddingImp]       = useState(false);

  // Profiles
  const [profiles, setProfiles] = useState<Profile[]>([]);

  // Selected step for sheet
  const [selectedStep, setSelectedStep] = useState<ProcessBucket | null>(null);

  // ── Load ──────────────────────────────────────────────────

  useEffect(() => {
    setEditName(area.name);
    setEditDesc(area.description ?? "");
    setNameChanged(false);
    setDescChanged(false);
    setStepDocsMap({});
    setSelectedStep(null);

    const load = async () => {
      setStepsLoading(true);
      // Steps first — needed for getChildCounts + stepDocs batch
      const subBuckets = await getProcessBuckets(area.id);
      setSteps(subBuckets);

      const stepIds = subBuckets.map((s: ProcessBucket) => s.id);
      const [linkedDocs, impRows, profileRows, subCounts] = await Promise.all([
        getLinkedDocs(area.slug),
        sb.from("process_improvements").select("id, bucket_id, step_id, title, kind, status, created_at, created_by").eq("bucket_id", area.id).order("created_at", { ascending: false }),
        sb.from("profiles").select("user_id, full_name, avatar_url").limit(100),
        getChildCounts(stepIds),
      ]);

      setDocs(linkedDocs);
      setImprovements(impRows.data ?? []);
      setProfiles(profileRows.data ?? []);
      setSubNodeCounts(subCounts);

      if (subBuckets.length > 0) {
        const slugs = subBuckets.map((s: ProcessBucket) => s.slug);
        // stepIds already derived above
        const { data: stepDocRows } = await sb
          .from("documents")
          .select("id, title, updated_at, icon, tags")
          .overlaps("tags", slugs);

        const docsMap: Record<string, LinkedDoc[]> = {};
        subBuckets.forEach((s: ProcessBucket) => { docsMap[s.id] = []; });
        (stepDocRows ?? []).forEach((doc: any) => {
          subBuckets.forEach((s: ProcessBucket) => {
            if ((doc.tags ?? []).includes(s.slug)) {
              docsMap[s.id] = [...(docsMap[s.id] ?? []), { id: doc.id, title: doc.title, updated_at: doc.updated_at, icon: doc.icon }];
            }
          });
        });
        setStepDocsMap(docsMap);
      }

      setStepsLoading(false);
    };
    load();
  }, [area.id, area.slug, workspaceId]);

  // ── Header ────────────────────────────────────────────────

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
    const updates = newSteps.map((s, i) => ({ ...s, bucket_order: i + 1 }));
    setSteps(updates);
    await Promise.all(updates.map((s) => updateBucket(s.id, { bucket_order: s.bucket_order })));
  };

  const deleteStep = async (id: string) => {
    if (!(await appConfirm({ title: "Delete this step?", confirmLabel: "Delete", destructive: true }))) return;
    await deleteBucket(id);
    setSteps((prev) => prev.filter((s) => s.id !== id));
    setStepDocsMap((prev) => { const next = { ...prev }; delete next[id]; return next; });
    if (selectedStep?.id === id) setSelectedStep(null);
  };

  const addStep = async () => {
    if (!newStepName.trim()) return;
    setSavingStep(true);
    try {
      const bucket = await createBucket(workspaceId, newStepName.trim(), area.id, { x: 0, y: steps.length * 180 }, steps.length, null, newStepType);
      setSteps((prev) => [...prev, bucket]);
      setStepDocsMap((prev) => ({ ...prev, [bucket.id]: [] }));
      setNewStepName(""); setNewStepType("process"); setAddingStep(false);
    } catch (e) { toast.error(String(e)); }
    finally { setSavingStep(false); }
  };

  // ── Step docs (2-way) ──────────────────────────────────────

  const handleLinkStepDoc = async (step: ProcessBucket, doc: { id: string; title: string; icon: string | null; tags: string[] }) => {
    const newTags = Array.from(new Set([...(doc.tags ?? []), step.slug]));
    await sb.from("documents").update({ tags: newTags }).eq("id", doc.id);
    const linked: LinkedDoc = { id: doc.id, title: doc.title, updated_at: new Date().toISOString(), icon: doc.icon };
    setStepDocsMap((prev) => ({ ...prev, [step.id]: [...(prev[step.id] ?? []), linked] }));
  };

  const handleUnlinkStepDoc = async (step: ProcessBucket, docId: string) => {
    const { data } = await sb.from("documents").select("tags").eq("id", docId).single();
    const newTags = ((data?.tags ?? []) as string[]).filter((t: string) => t !== step.slug);
    await sb.from("documents").update({ tags: newTags }).eq("id", docId);
    setStepDocsMap((prev) => ({ ...prev, [step.id]: (prev[step.id] ?? []).filter((d) => d.id !== docId) }));
  };

  // ── Step owner ─────────────────────────────────────────────

  const handleOwnerChange = async (stepId: string, ownerId: string | null) => {
    await updateBucket(stepId, { owner_id: ownerId });
    setSteps((prev) => prev.map((s) => s.id === stepId ? { ...s, owner_id: ownerId } : s));
    if (selectedStep?.id === stepId) setSelectedStep((prev) => prev ? { ...prev, owner_id: ownerId } : prev);
  };

  // ── Area-level docs ────────────────────────────────────────

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

  // ── Improvements ───────────────────────────────────────────

  const addImprovement = async () => {
    if (!newImpTitle.trim() || !user) return;
    setAddingImp(true);
    const { data, error } = await sb.from("process_improvements").insert({
      bucket_id: area.id,
      workspace_id: workspaceId,
      step_id: newImpStepId || null,
      title: newImpTitle.trim(),
      kind: newImpKind,
      status: "open",
      created_by: user.id,
    }).select().single();
    setAddingImp(false);
    if (error) { toast.error(error.message); return; }
    if (data) setImprovements((prev) => [data, ...prev]);
    setNewImpTitle(""); setNewImpStepId("");
  };

  const closeImprovement = async (id: string) => {
    setImprovements((prev) => prev.map((i) => i.id === id ? { ...i, status: "closed" } : i));
    await sb.from("process_improvements").update({ status: "closed" }).eq("id", id);
  };

  const promoteImpToTask = async (imp: Improvement) => {
    if (!user) return;
    const { data: task, error } = await sb.from("tasks").insert({
      title: imp.title, status: "todo", priority: "medium", created_by: user.id, assigned_to: user.id,
    }).select("id").single();
    if (error || !task) { toast.error(error?.message || "Failed"); return; }
    await sb.from("process_improvements").update({ converted_to_task_id: task.id, status: "converted" }).eq("id", imp.id);
    setImprovements((prev) => prev.map((i) => i.id === imp.id ? { ...i, status: "converted" } : i));
    toast.success("Task created");
  };

  const promoteImpToProject = async (imp: Improvement) => {
    if (!user) return;
    const { error } = await sb.from("projects").insert({
      title: imp.title, owner_id: user.id, created_by: user.id,
    });
    if (error) { toast.error(error.message); return; }
    await sb.from("process_improvements").update({ status: "converted" }).eq("id", imp.id);
    setImprovements((prev) => prev.map((i) => i.id === imp.id ? { ...i, status: "converted" } : i));
    toast.success("Project created");
  };

  // ── Derived ────────────────────────────────────────────────

  const openImprovements = improvements.filter((i) => i.status === "open" || i.status === "in_review");
  const stepRows = groupSteps(steps);
  const stepsWithOpenIssues = new Set(openImprovements.filter((i) => i.step_id).map((i) => i.step_id!));
  const stepOpenIssueCounts: Record<string, number> = {};
  for (const imp of openImprovements) {
    if (imp.step_id) stepOpenIssueCounts[imp.step_id] = (stepOpenIssueCounts[imp.step_id] ?? 0) + 1;
  }
  const stepsWithDocs = steps.filter((s) => (stepDocsMap[s.id] ?? []).length > 0);
  const totalDocCount = docs.length + steps.reduce((acc, s) => acc + (stepDocsMap[s.id] ?? []).length, 0);

  const stepNameFor = (stepId: string | null) =>
    stepId ? (steps.find((s) => s.id === stepId)?.name ?? null) : null;

  // ── Render ─────────────────────────────────────────────────

  return (
    <div>

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="px-8 pt-8 pb-6 border-b border-border/40" style={{ borderLeft: `3px solid ${area.color}` }}>
        {vertical && (
          <div className="mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white shadow-sm" style={{ background: vertical.color }}>
              {vertical.name}
            </span>
          </div>
        )}
        <input
          value={editName}
          onChange={(e) => { setEditName(e.target.value); setNameChanged(true); }}
          onBlur={saveName}
          onKeyDown={(e) => e.key === "Enter" && saveName()}
          className="w-full text-3xl font-bold text-foreground bg-transparent outline-none border-b-2 border-transparent hover:border-border/30 focus:border-primary/40 pb-1 transition-colors mb-2"
          placeholder="Area name"
        />
        <textarea
          value={editDesc}
          onChange={(e) => { setEditDesc(e.target.value); setDescChanged(true); }}
          onBlur={saveDesc}
          rows={2}
          placeholder="Describe what this function does and why it matters…"
          className="w-full text-sm text-muted-foreground bg-transparent outline-none border-b border-transparent hover:border-border/20 focus:border-primary/30 resize-none transition-colors placeholder:text-muted-foreground/30 leading-relaxed"
        />
        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground/50">
          <span>{steps.length} {steps.length === 1 ? "step" : "steps"}</span>
          {totalDocCount > 0 && <><span>·</span><span>{totalDocCount} {totalDocCount === 1 ? "doc" : "docs"}</span></>}
          {openImprovements.length > 0 && (
            <><span>·</span><span className="text-amber-600 dark:text-amber-400">{openImprovements.length} open {openImprovements.length === 1 ? "issue" : "issues"}</span></>
          )}
        </div>
      </div>

      {/* ── Two-panel body ─────────────────────────────────────── */}
      <div className="flex items-start">

        {/* ── Left: Process ──────────────────────────────────────── */}
        <div className="flex-1 min-w-0 px-8 py-8">
          <div className="flex items-center gap-2 mb-5">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Process</h2>
            <div className="flex-1 h-px bg-border/40" />
            {!addingStep && (
              <button onClick={() => setAddingStep(true)} className="text-[11px] text-muted-foreground/50 hover:text-foreground flex items-center gap-1 transition-colors">
                <Plus className="h-3 w-3" /> Add step
              </button>
            )}
          </div>

          {stepsLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground/40">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="space-y-3">
              {steps.length === 0 && !addingStep && (
                <div className="rounded-xl border-2 border-dashed border-border/40 p-10 text-center cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-all" onClick={() => setAddingStep(true)}>
                  <Plus className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground/50">Add your first process step</p>
                </div>
              )}

              {stepRows.map((row) => {
                if (Array.isArray(row)) {
                  const groupName = row[0].step_group!;
                  return (
                    <div key={`group-${groupName}`} className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-1 flex items-center gap-1.5">
                        <Layers className="h-2.5 w-2.5" /> {groupName}
                      </p>
                      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
                        {row.map((step) => {
                          const fi = steps.indexOf(step);
                          return (
                            <StepCard key={step.id} step={step} flatIndex={fi} total={steps.length} inGroup
                              hasIssues={stepsWithOpenIssues.has(step.id)}
                              stepDocs={stepDocsMap[step.id] ?? []}
                              profiles={profiles}
                              onOwnerChange={handleOwnerChange}
                              onMoveUp={() => moveStep(fi, "up")}
                              onMoveDown={() => moveStep(fi, "down")}
                              onDelete={() => deleteStep(step.id)}
                              onUpdate={(patch) => setSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, ...patch } : s))}
                              onOpen={() => setSelectedStep(step)}
                              subNodeCount={subNodeCounts[step.id] ?? 0}
                              openIssueCount={stepOpenIssueCounts[step.id] ?? 0}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                } else {
                  const fi = steps.indexOf(row);
                  return (
                    <StepCard key={row.id} step={row} flatIndex={fi} total={steps.length}
                      hasIssues={stepsWithOpenIssues.has(row.id)}
                      stepDocs={stepDocsMap[row.id] ?? []}
                      profiles={profiles}
                      onOwnerChange={handleOwnerChange}
                      onMoveUp={() => moveStep(fi, "up")}
                      onMoveDown={() => moveStep(fi, "down")}
                      onDelete={() => deleteStep(row.id)}
                      onUpdate={(patch) => setSteps((prev) => prev.map((s) => s.id === row.id ? { ...s, ...patch } : s))}
                      onOpen={() => setSelectedStep(row)}
                      subNodeCount={subNodeCounts[row.id] ?? 0}
                      openIssueCount={stepOpenIssueCounts[row.id] ?? 0}
                    />
                  );
                }
              })}

              {addingStep && (
                <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    {NODE_TYPE_OPTIONS.map((t) => (
                      <button key={t} onClick={() => setNewStepType(t)}
                        className={cn("px-2.5 py-1 rounded-md text-xs font-medium border transition-all capitalize",
                          newStepType === t ? "border-primary bg-primary text-primary-foreground" : "border-border/40 text-muted-foreground hover:border-border")}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <input autoFocus value={newStepName} onChange={(e) => setNewStepName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addStep(); if (e.key === "Escape") { setAddingStep(false); setNewStepName(""); } }}
                    placeholder="Step name…"
                    className="w-full bg-transparent text-sm font-medium outline-none border-b border-border/40 focus:border-primary/40 pb-1 transition-colors"
                  />
                  <div className="flex gap-2">
                    <button onClick={addStep} disabled={!newStepName.trim() || savingStep}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground disabled:opacity-40">
                      {savingStep ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Add step
                    </button>
                    <button onClick={() => { setAddingStep(false); setNewStepName(""); }} className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: Sidebar ─────────────────────────────────────── */}
        <div className="w-96 shrink-0 border-l border-border/30 px-6 py-8 space-y-5 sticky top-0 self-start overflow-y-auto" style={{ maxHeight: "calc(100vh - 4rem)" }}>

          {/* Playbook */}
          <SidebarSection title="Playbook" badge={totalDocCount > 0 ? <span className="text-[10px] text-muted-foreground/50">{totalDocCount}</span> : undefined}>
            <div className="space-y-4">
              <div className="space-y-2">
                {docs.length > 0 && (
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">Area</p>
                )}
                {docs.map((doc) => (
                  <div key={doc.id} className="group flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/40 bg-background/50 hover:border-border/70 transition-colors">
                    <span className="text-sm shrink-0">{doc.icon ?? "📄"}</span>
                    <span className="flex-1 text-xs font-medium text-foreground truncate">{doc.title}</span>
                    <button onClick={() => unlinkDoc(doc)} className="opacity-0 group-hover:opacity-100 text-muted-foreground/30 hover:text-red-400 transition-opacity shrink-0"><X className="h-3 w-3" /></button>
                  </div>
                ))}
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/30" />
                  <input value={docSearch} onChange={(e) => { setDocSearch(e.target.value); searchDocs(e.target.value); }}
                    placeholder="Link an area-level doc…"
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-border/40 bg-background outline-none focus:border-primary/40 transition-colors" />
                  {docSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/30 animate-spin" />}
                </div>
                {docResults.length > 0 && (
                  <div className="rounded-lg border border-border/60 bg-background shadow-sm overflow-hidden divide-y divide-border/30">
                    {docResults.map((doc) => {
                      const already = docs.some((d) => d.id === doc.id);
                      return (
                        <button key={doc.id} onClick={() => !already && linkDoc(doc)} disabled={linkingDocId === doc.id || already}
                          className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted/40 disabled:opacity-60 transition-colors">
                          <span>{doc.icon ?? "📄"}</span>
                          <span className="flex-1 truncate">{doc.title}</span>
                          {already && <span className="text-[10px] text-emerald-600 shrink-0">linked</span>}
                          {linkingDocId === doc.id && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {stepsWithDocs.length > 0 && (
                <div className="space-y-3 pt-1 border-t border-border/30">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 pt-2">By Step</p>
                  {stepsWithDocs.map((step) => {
                    const sDocs = stepDocsMap[step.id] ?? [];
                    const fi = steps.indexOf(step);
                    return (
                      <div key={step.id} className="space-y-1">
                        <button onClick={() => setSelectedStep(step)}
                          className="text-[10px] text-muted-foreground/50 font-medium flex items-center gap-1 hover:text-foreground transition-colors">
                          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] font-bold text-white" style={{ background: step.color }}>
                            {fi + 1}
                          </span>
                          {step.name}
                        </button>
                        {sDocs.map((doc) => (
                          <div key={doc.id} className="group flex items-center gap-2 pl-5 pr-2 py-1.5 rounded-lg border border-border/30 bg-background/50 text-xs hover:border-border/60 transition-colors">
                            <span className="shrink-0">{doc.icon ?? "📄"}</span>
                            <span className="flex-1 truncate font-medium">{doc.title}</span>
                            <button onClick={() => handleUnlinkStepDoc(step, doc.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground/30 hover:text-red-400 transition-opacity shrink-0">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {totalDocCount === 0 && (
                <p className="text-xs text-muted-foreground/30 italic">No docs linked yet — link to the area above or open a step to link directly</p>
              )}
            </div>
          </SidebarSection>

          {/* Issues & Ideas */}
          <SidebarSection title="Issues & Ideas" badge={openImprovements.length > 0 ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
              {openImprovements.length} open
            </span>
          ) : undefined}>
            <div className="space-y-3">
              <div className="space-y-2 p-3 rounded-xl border border-border/40 bg-background/60">
                <select value={newImpKind} onChange={(e) => setNewImpKind(e.target.value as ImprovementKind)}
                  className="text-[11px] bg-transparent border border-border/40 rounded-md px-2 py-1 outline-none text-muted-foreground">
                  <option value="idea">Idea</option>
                  <option value="pain_point">Pain Point</option>
                  <option value="observation">Observation</option>
                  <option value="improvement">Improvement</option>
                </select>
                <input value={newImpTitle} onChange={(e) => setNewImpTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addImprovement(); }}
                  placeholder="Log an issue or idea…"
                  className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/40 border-b border-border/30 focus:border-primary/40 pb-1 transition-colors" />
                {steps.length > 0 && (
                  <select value={newImpStepId} onChange={(e) => setNewImpStepId(e.target.value)}
                    className="w-full text-[11px] bg-transparent border border-border/30 rounded-md px-2 py-1 outline-none text-muted-foreground">
                    <option value="">Area-level (no specific step)</option>
                    {steps.map((s, i) => <option key={s.id} value={s.id}>{i + 1}. {s.name}</option>)}
                  </select>
                )}
                <button onClick={addImprovement} disabled={addingImp || !newImpTitle.trim()}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground disabled:opacity-40">
                  {addingImp ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add
                </button>
              </div>

              {improvements.length === 0 ? (
                <p className="text-xs text-muted-foreground/30 italic px-1 py-2">None logged yet</p>
              ) : (
                <div className="space-y-1.5">
                  {improvements.map((imp) => {
                    const Icon = KIND_ICON[imp.kind];
                    const closed = imp.status === "closed";
                    const converted = imp.status === "converted";
                    const active = !closed && !converted;
                    const stepName = stepNameFor(imp.step_id);
                    const creator = profiles.find((p) => p.user_id === imp.created_by);
                    return (
                      <div key={imp.id} className={cn(
                        "group rounded-xl border bg-card/60 hover:bg-card transition-all p-3.5",
                        closed ? "border-border/20 opacity-40" : "border-border/40 hover:border-border/60",
                        converted && "opacity-60",
                      )}>
                        <div className="flex items-start gap-3">
                          <span className={cn(
                            "inline-flex items-center justify-center w-6 h-6 rounded-lg shrink-0 mt-0.5",
                            converted ? "bg-emerald-500/10 text-emerald-500/60" : KIND_CLS[imp.kind],
                          )}>
                            {converted
                              ? <Check className="h-3 w-3" />
                              : <Icon className="h-3 w-3" />
                            }
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-[13px] leading-snug",
                              closed ? "line-through text-foreground/30" : converted ? "text-foreground/50" : "text-foreground",
                            )}>
                              {imp.title}
                              {converted && <span className="ml-2 text-[11px] text-foreground/25">→ done</span>}
                            </p>
                            {(stepName || creator) && (
                              <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                                {stepName && (
                                  <button
                                    onClick={() => { const s = steps.find((st) => st.id === imp.step_id); if (s) setSelectedStep(s); }}
                                    className="text-[11px] text-foreground/35 hover:text-foreground transition-colors flex items-center gap-1"
                                  >
                                    <span className="w-1 h-1 rounded-full bg-foreground/25 inline-block" />
                                    Step {steps.findIndex((s) => s.id === imp.step_id) + 1}: {stepName}
                                  </button>
                                )}
                                {creator && (
                                  <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground/30">
                                    {creator.avatar_url
                                      ? <img src={creator.avatar_url} className="w-3.5 h-3.5 rounded-full object-cover" />
                                      : <span className="w-3.5 h-3.5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[7px] font-bold">{initials(creator.full_name)}</span>
                                    }
                                    {creator.full_name?.split(" ")[0]}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          {active && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                              <button onClick={() => promoteImpToTask(imp)} className="p-1.5 rounded-lg text-foreground/30 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors" title="Convert to task">
                                <ListTodo className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => promoteImpToProject(imp)} className="p-1.5 rounded-lg text-foreground/30 hover:text-blue-500 hover:bg-blue-500/10 transition-colors" title="Convert to project">
                                <FolderOpen className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => closeImprovement(imp.id)} className="p-1.5 rounded-lg text-foreground/30 hover:text-foreground hover:bg-foreground/8 transition-colors" title="Dismiss">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </SidebarSection>

        </div>
      </div>

      {/* ── Step detail sheet ──────────────────────────────────── */}
      <StepDetailSheet
        step={selectedStep}
        workspaceId={workspaceId}
        stepDocs={selectedStep ? (stepDocsMap[selectedStep.id] ?? []) : []}
        onLinkStepDoc={handleLinkStepDoc}
        onUnlinkStepDoc={handleUnlinkStepDoc}
        profiles={profiles}
        onOwnerChange={handleOwnerChange}
        onStepUpdate={(patch) => {
          setSteps((prev) => prev.map((s) => s.id === selectedStep?.id ? { ...s, ...patch } : s));
          setSelectedStep((prev) => prev ? { ...prev, ...patch } : prev);
        }}
        improvements={improvements}
        onClose={() => setSelectedStep(null)}
      />
    </div>
  );
}
