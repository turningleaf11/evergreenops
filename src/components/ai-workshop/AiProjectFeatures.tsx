import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Trash2, Check, GripVertical } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { appConfirm } from "@/components/AppConfirm";
import { cn } from "@/lib/utils";
import { QuickAddPopover } from "@/components/primitives";

const sb = supabase as any;

type FeatureStatus = "idea" | "planned" | "building" | "done" | "dropped";

type Feature = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: FeatureStatus;
  priority: string;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
};

const STATUS_TONE: Record<FeatureStatus, string> = {
  idea:     "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
  planned:  "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
  building: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  done:     "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  dropped:  "bg-muted text-muted-foreground border-border/40",
};
const STATUS_LABEL: Record<FeatureStatus, string> = {
  idea: "Idea", planned: "Planned", building: "Building", done: "Done", dropped: "Dropped",
};

export function AiProjectFeatures({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideDone, setHideDone] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await sb
      .from("ai_project_features")
      .select("*")
      .eq("project_id", projectId)
      .order("status", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setFeatures((data ?? []) as Feature[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  const addFeature = async (title: string) => {
    if (!title.trim()) return;
    const next_order = Math.max(0, ...features.map((f) => f.sort_order)) + 10;
    const { data, error } = await sb.from("ai_project_features").insert({
      project_id: projectId,
      title: title.trim(),
      created_by: user?.id ?? null,
      status: "idea",
      sort_order: next_order,
    }).select().single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    if (data) setFeatures((prev) => [...prev, data as Feature]);
  };

  const updateFeature = async (id: string, patch: Partial<Feature>) => {
    setFeatures((prev) => prev.map((f) => f.id === id ? { ...f, ...patch } : f));
    await sb.from("ai_project_features").update(patch).eq("id", id);
  };

  const toggleDone = async (f: Feature) => {
    const isDone = f.status === "done";
    const next: Partial<Feature> = isDone
      ? { status: "building" as FeatureStatus, completed_at: null }
      : { status: "done" as FeatureStatus, completed_at: new Date().toISOString() };
    await updateFeature(f.id, next);
  };

  const setStatus = async (f: Feature, status: FeatureStatus) => {
    await updateFeature(f.id, {
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
    });
  };

  const remove = async (id: string) => {
    if (!(await appConfirm({ title: "Delete this feature?", confirmLabel: "Delete", destructive: true }))) return;
    setFeatures((prev) => prev.filter((f) => f.id !== id));
    await sb.from("ai_project_features").delete().eq("id", id);
  };

  const visible = hideDone
    ? features.filter((f) => f.status !== "done" && f.status !== "dropped")
    : features;

  // Group by status order
  const order: FeatureStatus[] = ["idea", "planned", "building", "done", "dropped"];
  const grouped = order
    .map((s) => ({ status: s, items: visible.filter((f) => f.status === s) }))
    .filter((g) => g.items.length > 0);

  const doneCount = features.filter((f) => f.status === "done").length;
  const totalActive = features.filter((f) => f.status !== "dropped").length;

  return (
    <div className="space-y-4">
      {/* Header strip with progress + filter */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] text-muted-foreground">
          {totalActive > 0 ? (
            <>
              <span className="font-semibold text-foreground">{doneCount}</span> of {totalActive} done
              <span className="ml-2 inline-flex items-center gap-1.5">
                <span className="h-1 w-24 bg-muted rounded-full overflow-hidden">
                  <span
                    className="block h-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.round((doneCount / totalActive) * 100)}%` }}
                  />
                </span>
              </span>
            </>
          ) : (
            <span>No features yet</span>
          )}
        </div>
        <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
          Hide done
        </label>
      </div>

      <QuickAddPopover triggerLabel="Add feature" placeholder="Feature or idea you want built…" onAdd={addFeature} />

      {/* List */}
      {loading ? (
        <p className="text-xs text-muted-foreground italic py-4">Loading…</p>
      ) : grouped.length === 0 ? (
        <div className="text-center py-8 space-y-1">
          <p className="text-sm text-muted-foreground">No features yet.</p>
          <p className="text-xs text-muted-foreground/70">Drop ideas, mark them off as you ship.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((g) => (
            <div key={g.status} className="space-y-1">
              <div className="flex items-center gap-2 px-1">
                <span className={cn("text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border", STATUS_TONE[g.status])}>
                  {STATUS_LABEL[g.status]}
                </span>
                <span className="text-[10px] text-muted-foreground/60">{g.items.length}</span>
              </div>
              <ul className="space-y-1">
                {g.items.map((f) => (
                  <FeatureRow
                    key={f.id}
                    feature={f}
                    onToggleDone={() => toggleDone(f)}
                    onSetStatus={(s) => setStatus(f, s)}
                    onUpdate={(patch) => updateFeature(f.id, patch)}
                    onRemove={() => remove(f.id)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FeatureRow({
  feature, onToggleDone, onSetStatus, onUpdate, onRemove,
}: {
  feature: Feature;
  onToggleDone: () => void;
  onSetStatus: (s: FeatureStatus) => void;
  onUpdate: (patch: Partial<Feature>) => void;
  onRemove: () => void;
}) {
  const [title, setTitle] = useState(feature.title);
  const [editing, setEditing] = useState(false);
  const isDone = feature.status === "done";

  const saveTitle = () => {
    setEditing(false);
    if (title.trim() && title !== feature.title) onUpdate({ title: title.trim() });
    else setTitle(feature.title);
  };

  return (
    <li className="group flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-muted/30 transition-colors">
      <GripVertical className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
      <button
        onClick={onToggleDone}
        className={cn(
          "h-4 w-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors",
          isDone ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/40 hover:border-primary",
        )}
        title={isDone ? "Reopen" : "Mark done"}
      >
        {isDone && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
      </button>

      {editing ? (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveTitle();
            if (e.key === "Escape") { setTitle(feature.title); setEditing(false); }
          }}
          className="flex-1 bg-transparent outline-none text-sm"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className={cn("flex-1 text-left text-sm truncate", isDone && "line-through text-muted-foreground")}
        >
          {feature.title}
        </button>
      )}

      <select
        value={feature.status}
        onChange={(e) => onSetStatus(e.target.value as FeatureStatus)}
        className="text-[10px] bg-transparent border border-border/40 rounded px-1 py-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <option value="idea">Idea</option>
        <option value="planned">Planned</option>
        <option value="building">Building</option>
        <option value="done">Done</option>
        <option value="dropped">Dropped</option>
      </select>

      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 h-6 w-6 rounded inline-flex items-center justify-center text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 shrink-0"
        title="Delete"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </li>
  );
}
