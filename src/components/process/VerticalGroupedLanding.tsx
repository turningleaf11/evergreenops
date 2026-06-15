import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  FolderTree, ChevronRight, MessageSquare, Loader2,
  Lightbulb, AlertTriangle, Eye, ArrowUpCircle, Plus, Trash2,
  ListTodo, FolderPlus, Check, Megaphone, Pin, ChevronDown,
  ChevronUp, LayoutGrid, X, Pencil, Trash2 as TrashIcon, Check as CheckIcon,
} from "lucide-react";
import { toast } from "sonner";
import { appConfirm } from "@/components/AppConfirm";
import type { ProcessBucket, ProcessVertical } from "@/lib/processMap";
import { updateVertical, deleteVertical } from "@/lib/processMap";
import { cn } from "@/lib/utils";

const sb = supabase as any;

// ── Improvement types ──────────────────────────────────────

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

// ── Announcement banner ────────────────────────────────────

interface Announcement {
  id: string;
  title: string;
  content: string;
  author_name: string | null;
  pinned: boolean;
  created_at: string;
}

function AnnouncementBanner() {
  const { isAdmin } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    sb.from("announcements")
      .select("*")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }: { data: Announcement[] | null }) => setAnnouncements(data ?? []));
  }, []);

  const visible = announcements.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  const pinned = visible.filter((a) => a.pinned);
  const recent = visible.filter((a) => !a.pinned);
  const shown = expanded ? visible : (pinned.length > 0 ? pinned.slice(0, 1) : recent.slice(0, 1));

  return (
    <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 dark:bg-amber-900/10 dark:border-amber-700/30 px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <Megaphone className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">What's New</span>
        {visible.length > 1 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5"
          >
            {expanded ? <><ChevronUp className="h-3 w-3" />Less</> : <><ChevronDown className="h-3 w-3" />{visible.length - 1} more</>}
          </button>
        )}
      </div>
      {shown.map((a) => (
        <div key={a.id} className="flex items-start gap-2">
          {a.pinned && <Pin className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-foreground">{a.title}</span>
            {a.content && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.content}</p>}
            {a.author_name && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{a.author_name}</p>}
          </div>
          <button
            onClick={() => setDismissed((prev) => new Set([...prev, a.id]))}
            className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Vertical section ───────────────────────────────────────

const VERTICAL_COLORS = [
  "#16a34a", "#2563eb", "#dc2626", "#7c3aed", "#db2777",
  "#ea580c", "#0891b2", "#65a30d",
];

interface VerticalSectionProps {
  vertical: ProcessVertical;
  areas: ProcessBucket[];
  bucketCounts: Record<string, { children: number; steps: number; projects: number }>;
  onOpenArea: (b: ProcessBucket) => void;
  onCreateArea: (name: string, verticalId: string) => Promise<void>;
  onUpdated: (id: string, patch: Partial<ProcessVertical>) => void;
  onDeleted: (id: string) => void;
}

function VerticalSection({ vertical, areas, bucketCounts, onOpenArea, onCreateArea, onUpdated, onDeleted }: VerticalSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  // Inline edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(vertical.name);
  const [editColor, setEditColor] = useState(vertical.color);
  const [savingEdit, setSavingEdit] = useState(false);

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    setSavingEdit(true);
    try {
      await updateVertical(vertical.id, { name: editName.trim(), color: editColor });
      onUpdated(vertical.id, { name: editName.trim(), color: editColor });
      setEditing(false);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!await (import("@/components/AppConfirm").then(m => m.appConfirm({ title: `Delete "${vertical.name}"?`, body: "All areas in this vertical will become unassigned.", confirmLabel: "Delete", destructive: true })))) return;
    try {
      await deleteVertical(vertical.id);
      onDeleted(vertical.id);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await onCreateArea(newName.trim(), vertical.id);
      setNewName("");
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 group/header">
        {editing ? (
          <>
            <div className="flex items-center gap-2 flex-1">
              {VERTICAL_COLORS.map((c) => (
                <button key={c} onClick={() => setEditColor(c)}
                  className={cn("w-4 h-4 rounded-full shrink-0 transition-transform", editColor === c && "scale-125 ring-2 ring-offset-1 ring-offset-background")}
                  style={{ background: c }} />
              ))}
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setEditing(false); }}
                className="flex-1 text-sm font-bold bg-transparent border-b border-primary/40 outline-none"
              />
            </div>
            <button onClick={handleSaveEdit} disabled={savingEdit} className="text-emerald-600 hover:text-emerald-700 shrink-0">
              <CheckIcon className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setCollapsed((v) => !v)} className="flex items-center gap-2 group">
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: vertical.color }} />
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
                {vertical.name}
              </h2>
              {collapsed
                ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" />}
            </button>
            {vertical.description && !collapsed && (
              <span className="text-[11px] text-muted-foreground/60 truncate max-w-sm">{vertical.description}</span>
            )}
            <div className="ml-auto flex items-center gap-2 opacity-0 group-hover/header:opacity-100 transition-opacity">
              <button onClick={() => { setEditing(true); setEditName(vertical.name); setEditColor(vertical.color); }}
                className="text-muted-foreground/50 hover:text-foreground" title="Edit vertical">
                <Pencil className="h-3 w-3" />
              </button>
              <button onClick={handleDelete} className="text-muted-foreground/50 hover:text-red-500" title="Delete vertical">
                <TrashIcon className="h-3 w-3" />
              </button>
              {!collapsed && (
                <button onClick={() => setAdding((v) => !v)}
                  className="text-[11px] text-muted-foreground/60 hover:text-foreground flex items-center gap-1 transition-colors">
                  <Plus className="h-3 w-3" /> Area
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {!collapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pl-4">
          {adding && (
            <div className="rounded-xl border-2 border-dashed p-4 flex flex-col gap-2" style={{ borderColor: vertical.color + "60" }}>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") { setAdding(false); setNewName(""); }
                }}
                placeholder="Area name…"
                className="text-sm bg-transparent outline-none placeholder:text-muted-foreground/40 font-medium"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || saving}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-white disabled:opacity-40"
                  style={{ background: vertical.color }}
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  Add
                </button>
                <button
                  onClick={() => { setAdding(false); setNewName(""); }}
                  className="px-2 py-1 rounded-md text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {areas.length === 0 && !adding ? (
            <p className="text-sm text-muted-foreground/50 italic col-span-full py-1">
              No areas yet —{" "}
              <button onClick={() => setAdding(true)} className="underline underline-offset-2 hover:text-foreground">add one</button>
            </p>
          ) : (
            areas.map((area) => {
              const counts = bucketCounts[area.id] ?? { children: 0, steps: 0, projects: 0 };
              return (
                <button
                  key={area.id}
                  onClick={() => onOpenArea(area)}
                  className="text-left rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:shadow-md transition-all p-5 group"
                  style={{ borderTop: `4px solid ${area.color}` }}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-base font-bold text-foreground leading-snug">{area.name}</h3>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                  </div>
                  {area.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{area.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <FolderTree className="h-3 w-3" /> {counts.children} {counts.children === 1 ? "node" : "nodes"}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}

// ── Main component ─────────────────────────────────────────

interface Props {
  verticals: ProcessVertical[];
  areas: ProcessBucket[];
  bucketCounts: Record<string, { children: number; steps: number; projects: number }>;
  onOpenArea: (b: ProcessBucket) => void;
  onCreateVertical: (name: string, color: string) => Promise<void>;
  onCreateArea: (name: string, verticalId: string | null) => Promise<void>;
  onVerticalUpdated: (id: string, patch: Partial<ProcessVertical>) => void;
  onVerticalDeleted: (id: string) => void;
}

export function VerticalGroupedLanding({
  verticals,
  areas,
  bucketCounts,
  onOpenArea,
  onCreateVertical,
  onCreateArea,
  onVerticalUpdated,
  onVerticalDeleted,
}: Props) {
  const { user } = useAuth();

  // Improvements state
  const [improvements, setImprovements] = useState<Improvement[]>([]);
  const [loadingImprove, setLoadingImprove] = useState(true);
  const [filterBucketId, setFilterBucketId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newKind, setNewKind] = useState<ImprovementKind>("idea");
  const [newBucketId, setNewBucketId] = useState<string>("");
  const [addingImprove, setAddingImprove] = useState(false);

  // Create vertical dialog
  const [createVertOpen, setCreateVertOpen] = useState(false);
  const [vertName, setVertName] = useState("");
  const [vertColor, setVertColor] = useState(VERTICAL_COLORS[0]);
  const [savingVert, setSavingVert] = useState(false);

  const loadImprovements = async () => {
    setLoadingImprove(true);
    const { data } = await sb
      .from("process_improvements")
      .select("*")
      .order("created_at", { ascending: false });
    setImprovements((data ?? []) as Improvement[]);
    setLoadingImprove(false);
  };

  useEffect(() => { loadImprovements(); }, []);

  // Group areas by vertical_id
  const areasByVertical = useMemo(() => {
    const map: Record<string, ProcessBucket[]> = {};
    for (const v of verticals) map[v.id] = [];
    for (const a of areas) {
      if (a.vertical_id && map[a.vertical_id]) {
        map[a.vertical_id].push(a);
      }
    }
    return map;
  }, [verticals, areas]);

  const unassignedAreas = useMemo(
    () => areas.filter((a) => !a.vertical_id || !verticals.find((v) => v.id === a.vertical_id)),
    [areas, verticals],
  );

  const addImprovement = async () => {
    if (!newTitle.trim() || !user) return;
    setAddingImprove(true);
    const { data, error } = await sb.from("process_improvements").insert({
      bucket_id: newBucketId || null,
      title: newTitle.trim(),
      kind: newKind,
      status: "open",
      created_by: user.id,
    }).select().single();
    setAddingImprove(false);
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
    await sb.from("process_improvements").update({ converted_to_task_id: task.id, status: "converted" }).eq("id", imp.id);
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
    await sb.from("process_improvements").update({ converted_to_project_id: proj.id, status: "converted" }).eq("id", imp.id);
    setImprovements((prev) => prev.map((i) => i.id === imp.id ? { ...i, status: "converted" } : i));
    toast.success("Project created");
  };

  const remove = async (id: string) => {
    if (!(await appConfirm({ title: "Delete this improvement?", confirmLabel: "Delete", destructive: true }))) return;
    setImprovements((prev) => prev.filter((i) => i.id !== id));
    await sb.from("process_improvements").delete().eq("id", id);
  };

  const handleCreateVertical = async () => {
    if (!vertName.trim()) return;
    setSavingVert(true);
    try {
      await onCreateVertical(vertName.trim(), vertColor);
      setVertName("");
      setVertColor(VERTICAL_COLORS[0]);
      setCreateVertOpen(false);
    } finally {
      setSavingVert(false);
    }
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
    <div className="px-6 py-6 max-w-[1500px] mx-auto space-y-8">
      {/* Announcements */}
      <AnnouncementBanner />

      {/* Verticals */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Business OS</h2>
          <button
            onClick={() => setCreateVertOpen(true)}
            className="ml-auto text-[11px] text-muted-foreground/60 hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <Plus className="h-3 w-3" /> Vertical
          </button>
        </div>

        {verticals.map((v) => (
          <VerticalSection
            key={v.id}
            vertical={v}
            areas={areasByVertical[v.id] ?? []}
            bucketCounts={bucketCounts}
            onOpenArea={onOpenArea}
            onCreateArea={onCreateArea}
            onUpdated={onVerticalUpdated}
            onDeleted={onVerticalDeleted}
          />
        ))}

        {unassignedAreas.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">Unassigned</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pl-4">
              {unassignedAreas.map((area) => {
                const counts = bucketCounts[area.id] ?? { children: 0 };
                return (
                  <button
                    key={area.id}
                    onClick={() => onOpenArea(area)}
                    className="text-left rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:shadow-md transition-all p-5 group"
                    style={{ borderTop: `4px solid ${area.color}` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base font-bold text-foreground">{area.name}</h3>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2">{counts.children} nodes</p>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Improvements inbox */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Improvements</h2>
          <span className="text-[11px] text-muted-foreground/70">— ideas, pain points & observations</span>
        </div>

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
              disabled={addingImprove || !newTitle.trim()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-primary text-primary-foreground disabled:opacity-40"
            >
              {addingImprove ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Add
            </button>
          </div>
        </div>

        {areas.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterBucketId(null)}
              className={cn("text-[11px] px-2 py-0.5 rounded-full border transition-colors", filterBucketId === null ? "bg-primary text-primary-foreground border-primary" : "border-border/40 text-muted-foreground hover:text-foreground")}
            >All</button>
            {areas.map((a) => (
              <button
                key={a.id}
                onClick={() => setFilterBucketId(a.id === filterBucketId ? null : a.id)}
                className={cn("text-[11px] px-2 py-0.5 rounded-full border transition-colors", filterBucketId === a.id ? "border-primary text-primary" : "border-border/40 text-muted-foreground hover:text-foreground")}
                style={{ borderColor: filterBucketId === a.id ? a.color : undefined }}
              >
                {a.name}
              </button>
            ))}
          </div>
        )}

        {loadingImprove ? (
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
                  className={cn("group rounded-lg border border-border/40 bg-card/40 p-3 flex items-start gap-3 hover:border-border/80 transition-colors", (converted || closed) && "opacity-60")}
                >
                  <span className={cn("inline-flex items-center gap-1 ring-1 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 mt-0.5", tone.cls)}>
                    <Icon className="h-2.5 w-2.5" />{tone.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm text-foreground", closed && "line-through")}>{imp.title}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">{bucketNameFor(imp.bucket_id)} · {imp.status}</p>
                  </div>
                  {!converted && !closed && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => promoteToTask(imp)} className="inline-flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20" title="Create task">
                        <ListTodo className="h-3 w-3" /> Task
                      </button>
                      <button onClick={() => promoteToProject(imp)} className="inline-flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-medium bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20" title="Convert to project">
                        <FolderPlus className="h-3 w-3" /> Project
                      </button>
                      <button onClick={() => setStatus(imp.id, "closed")} className="inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted" title="Close">
                        <Check className="h-3 w-3" />
                      </button>
                      <button onClick={() => remove(imp.id)} className="inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Delete">
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

      {/* Create Vertical dialog */}
      {createVertOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-2xl border border-border shadow-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">New Vertical</h3>
              <button onClick={() => setCreateVertOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                autoFocus
                value={vertName}
                onChange={(e) => setVertName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateVertical()}
                placeholder="Vertical name (e.g. Wholesale, Portfolio)"
                className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Color</p>
                <div className="flex gap-2 flex-wrap">
                  {VERTICAL_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setVertColor(c)}
                      className={cn("w-6 h-6 rounded-full transition-transform", vertColor === c && "scale-125 ring-2 ring-offset-2 ring-offset-card")}
                      style={{ background: c, ringColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCreateVertOpen(false)} className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              <button
                onClick={handleCreateVertical}
                disabled={!vertName.trim() || savingVert}
                className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-opacity"
                style={{ background: vertColor }}
              >
                {savingVert ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
