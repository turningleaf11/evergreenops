import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Lightbulb, Plus, MoreHorizontal, Trash2, Pencil, ArrowRight, CheckSquare, FolderKanban, Target, Compass, Map, Briefcase } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { EmptyState } from "@/components/shared/EmptyState";

type Idea = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  source: string;
  ai_cluster: string | null;
  ai_summary: string | null;
  effort_estimate: string | null;
  time_horizon: string | null;
  promoted_to_type: string | null;
  promoted_to_id: string | null;
  promoted_at: string | null;
  created_at: string;
};

const STATUSES = [
  { key: "captured", label: "Captured", color: "bg-blue-500/10 text-blue-700 border-blue-200" },
  { key: "evaluating", label: "Evaluating", color: "bg-amber-500/10 text-amber-700 border-amber-200" },
  { key: "parked", label: "Parked", color: "bg-muted text-muted-foreground border-border" },
  { key: "promoted", label: "Promoted", color: "bg-green-500/10 text-green-700 border-green-200" },
  { key: "killed", label: "Killed", color: "bg-red-500/10 text-red-700 border-red-200" },
];

const HORIZONS = [
  { key: "this_quarter", label: "This Quarter" },
  { key: "next_quarter", label: "Next Quarter" },
  { key: "this_year", label: "This Year" },
  { key: "someday", label: "Someday" },
];

const PROMOTE_TARGETS = [
  { key: "task", label: "Task", desc: "Quick action, no project needed", icon: CheckSquare },
  { key: "project", label: "Project", desc: "Becomes a new project in Execution Hub", icon: FolderKanban },
  { key: "goal", label: "Goal / Rock", desc: "Becomes a new goal in Execution Hub", icon: Target },
  { key: "business_plan", label: "Business Plan", desc: "Start a new venture plan, or add to one already underway", icon: Briefcase },
  { key: "strategy_item", label: "Strategy Item", desc: "Surfaces in Command tab strategy section", icon: Compass },
  { key: "roadmap", label: "Roadmap Initiative", desc: "Log it for the future roadmap — no action yet", icon: Map },
] as const;

type PromoteTarget = typeof PROMOTE_TARGETS[number]["key"];

const sb = supabase as any;

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

export function IdeaVault() {
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<Idea | null>(null);
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());

  const enrichIdea = useCallback(async (ideaId: string) => {
    setEnrichingIds(prev => { const n = new Set(prev); n.add(ideaId); return n; });
    try {
      await supabase.functions.invoke("idea-vault-enrich", { body: { ideaId } });
      const { data } = await sb.from("idea_vault").select("*").eq("id", ideaId).maybeSingle();
      if (data) setIdeas(prev => prev.map(i => i.id === ideaId ? (data as Idea) : i));
    } catch (e) {
      console.error("enrich failed", e);
    } finally {
      setEnrichingIds(prev => { const n = new Set(prev); n.delete(ideaId); return n; });
    }
  }, []);

  // capture modal
  const [captureOpen, setCaptureOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newHorizon, setNewHorizon] = useState<string>("");
  const [busy, setBusy] = useState(false);

  // edit modal
  const [editTarget, setEditTarget] = useState<Idea | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editHorizon, setEditHorizon] = useState<string>("");

  // promote modal
  const [promoteIdea, setPromoteIdea] = useState<Idea | null>(null);
  const [promoteTarget, setPromoteTarget] = useState<PromoteTarget | null>(null);
  const [promoteName, setPromoteName] = useState("");
  const [promoting, setPromoting] = useState(false);
  const [promoteBizPlanMode, setPromoteBizPlanMode] = useState<"new" | "existing">("new");
  const [promoteExistingPlanId, setPromoteExistingPlanId] = useState<string | null>(null);
  const [bizPlans, setBizPlans] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    sb.from("business_plans").select("id, title").order("title").then(({ data }: any) => {
      if (data) setBizPlans(data);
    });
  }, []);

  const load = useCallback(async () => {
    const { data, error } = await sb.from("idea_vault").select("*").order("created_at", { ascending: false });
    if (error) { toast({ title: "Error loading ideas", description: error.message, variant: "destructive" }); return; }
    if (data) setIdeas(data as Idea[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-enrich any idea that hasn't been processed yet (e.g. arrived via triage).
  // Skip manual captures — those should land raw, with the user adding labels/track themselves.
  useEffect(() => {
    const pending = ideas.filter(i =>
      !i.ai_summary && !i.ai_cluster && !enrichingIds.has(i.id) && i.source !== "manual"
    );
    if (pending.length === 0) return;
    pending.slice(0, 3).forEach(i => enrichIdea(i.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideas]);

  const filtered = useMemo(() => {
    if (filter === "all") {
      // Hide Promoted & Killed unless explicitly filtered
      return ideas.filter(i => i.status !== "promoted" && i.status !== "killed");
    }
    return ideas.filter(i => i.status === filter);
  }, [ideas, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: ideas.filter(i => i.status !== "promoted" && i.status !== "killed").length,
    };
    for (const s of STATUSES) c[s.key] = ideas.filter(i => i.status === s.key).length;
    return c;
  }, [ideas]);

  const resetCapture = () => {
    setNewTitle(""); setNewDesc(""); setNewHorizon("");
  };

  const create = async () => {
    if (!newTitle.trim() || !user) return;
    setBusy(true);
    const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("user_id", user.id).maybeSingle();
    const { data: inserted, error } = await sb.from("idea_vault").insert({
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      time_horizon: newHorizon || null,
      created_by: user.id,
      workspace_id: profile?.workspace_id ?? null,
      source: "manual",
      status: "captured",
    }).select("*").maybeSingle();
    setBusy(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    resetCapture();
    setCaptureOpen(false);
    toast({ title: "Idea captured" });
    if (inserted) {
      setIdeas(prev => [inserted as Idea, ...prev]);
      // Manual captures stay raw — no auto-labeling. Use the enrich button if you want AI cluster/summary.
    } else {
      load();
    }
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await sb.from("idea_vault").update({ status }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else load();
  };

  const openEdit = (idea: Idea) => {
    setEditTarget(idea);
    setEditTitle(idea.title);
    setEditDesc(idea.description || "");
    setEditHorizon(idea.time_horizon || "");
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    const { error } = await sb.from("idea_vault").update({
      title: editTitle.trim(),
      description: editDesc.trim() || null,
      time_horizon: editHorizon || null,
    }).eq("id", editTarget.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { setEditTarget(null); load(); }
  };

  const remove = async (id: string) => {
    const { error } = await sb.from("idea_vault").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { setDeleteTarget(null); load(); }
  };

  const openPromote = (idea: Idea) => {
    setPromoteIdea(idea);
    setPromoteTarget(null);
    setPromoteName(idea.title);
    setPromoteBizPlanMode("new");
    setPromoteExistingPlanId(null);
  };

  const confirmPromote = async () => {
    if (!promoteIdea || !promoteTarget || !user) return;
    setPromoting(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("user_id", user.id).maybeSingle();
      const ws = profile?.workspace_id ?? null;
      const name = promoteName.trim() || promoteIdea.title;
      let newId: string | null = null;

      if (promoteTarget === "task") {
        const { data, error } = await supabase.from("tasks").insert({
          title: name,
          description: promoteIdea.description || "",
          created_by: user.id,
          assigned_to: user.id,
          status: "todo",
          priority: "medium",
        }).select("id").maybeSingle();
        if (error) throw error;
        newId = data?.id ?? null;
      } else if (promoteTarget === "project") {
        const { data, error } = await supabase.from("projects").insert({
          title: name,
          description: promoteIdea.description || "",
          created_by: user.id,
          owner_id: user.id,
          status: "not_started",
          priority: "medium",
          workspace_id: ws,
        }).select("id").maybeSingle();
        if (error) throw error;
        newId = data?.id ?? null;
      } else if (promoteTarget === "goal") {
        const now = new Date();
        const q = `Q${Math.floor(now.getMonth() / 3) + 1}`;
        const { data, error } = await supabase.from("goals").insert({
          title: name,
          description: promoteIdea.description || "",
          created_by: user.id,
          owner_id: user.id,
          status: "on_track",
          quarter: q,
          year: now.getFullYear(),
          workspace_id: ws,
        }).select("id").maybeSingle();
        if (error) throw error;
        newId = data?.id ?? null;
      } else if (promoteTarget === "business_plan") {
        const seed = `<h3>${escapeHtml(promoteIdea.title)}</h3>${promoteIdea.description ? `<p>${escapeHtml(promoteIdea.description)}</p>` : ""}${promoteIdea.ai_summary ? `<p><em>${escapeHtml(promoteIdea.ai_summary)}</em></p>` : ""}`;
        if (promoteBizPlanMode === "new") {
          const { data, error } = await sb.from("business_plans").insert({
            title: name,
            one_liner: promoteIdea.description || promoteIdea.ai_summary || null,
            owner_id: user.id,
            created_by: user.id,
            status: "planning",
            workspace_id: ws,
            plan_doc: seed,
          }).select("id").maybeSingle();
          if (error) throw error;
          newId = data?.id ?? null;
        } else {
          if (!promoteExistingPlanId) throw new Error("Choose a plan to add this to.");
          const { data: existingPlan, error: fetchError } = await sb.from("business_plans").select("plan_doc").eq("id", promoteExistingPlanId).maybeSingle();
          if (fetchError) throw fetchError;
          const merged = `${existingPlan?.plan_doc || ""}${existingPlan?.plan_doc ? "<hr />" : ""}${seed}`;
          const { error } = await sb.from("business_plans").update({ plan_doc: merged }).eq("id", promoteExistingPlanId);
          if (error) throw error;
          newId = promoteExistingPlanId;
        }
      } else if (promoteTarget === "strategy_item") {
        const { data, error } = await sb.from("strategy_items").insert({
          title: name,
          description: promoteIdea.description || "",
          created_by: user.id,
          type: "objective",
          workspace_id: ws,
        }).select("id").maybeSingle();
        if (error) throw error;
        newId = data?.id ?? null;
      }
      // roadmap: no record created

      await sb.from("idea_vault").update({
        status: "promoted",
        promoted_to_type: promoteTarget,
        promoted_to_id: newId,
        promoted_at: new Date().toISOString(),
      }).eq("id", promoteIdea.id);

      if (promoteTarget === "roadmap") {
        toast({ title: "Logged for your future roadmap." });
      } else {
        const label = PROMOTE_TARGETS.find(t => t.key === promoteTarget)?.label;
        toast({ title: `Promoted to ${label}`, description: name });
      }
      setPromoteIdea(null);
      setPromoteTarget(null);
      load();
    } catch (e: any) {
      toast({ title: "Promotion failed", description: e.message, variant: "destructive" });
    } finally {
      setPromoting(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const promoteConfirmDisabled =
    promoteTarget === "roadmap"
      ? false
      : promoteTarget === "business_plan"
        ? (promoteBizPlanMode === "new" ? !promoteName.trim() : !promoteExistingPlanId)
        : !promoteName.trim();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" /> Idea Vault
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Raw thinking. Captured automatically from Brain Dump triage or added manually.
          </p>
        </div>
        <Button size="sm" onClick={() => setCaptureOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Capture Idea
        </Button>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" count={counts.all} />
        {STATUSES.map(s => (
          <FilterChip key={s.key} active={filter === s.key} onClick={() => setFilter(s.key)} label={s.label} count={counts[s.key] || 0} />
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="No ideas yet"
          description="Dump something into Brain Dump and let AI triage surface it here, or capture an idea directly."
          actionLabel="Capture Idea"
          actionIcon={Plus}
          onAction={() => setCaptureOpen(true)}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(idea => {
            const meta = STATUSES.find(s => s.key === idea.status) || STATUSES[0];
            const horizon = HORIZONS.find(h => h.key === idea.time_horizon);
            return (
              <div key={idea.id} className="group rounded-lg border border-border bg-card p-3.5 hover:border-border/80 transition">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{idea.title}</p>
                    {idea.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{idea.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className={cn("text-[10px] font-medium uppercase px-2 py-0.5 rounded-full border", meta.color)}>
                        {meta.label}
                      </span>
                      {idea.ai_cluster ? (
                        <Badge variant="secondary" className="text-[10px]">{idea.ai_cluster}</Badge>
                      ) : enrichingIds.has(idea.id) ? (
                        <span className="inline-block h-4 w-20 rounded-full bg-muted animate-pulse" aria-label="AI analyzing idea" />
                      ) : null}
                      {horizon && <Badge variant="outline" className="text-[10px]">{horizon.label}</Badge>}
                      <span className="text-[10px] text-muted-foreground ml-auto">{formatDate(idea.created_at)}</span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition shrink-0">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => setStatus(idea.id, "evaluating")} disabled={idea.status === "evaluating"}>
                        Mark as Evaluating
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStatus(idea.id, "parked")} disabled={idea.status === "parked"}>
                        Park It
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStatus(idea.id, "killed")} disabled={idea.status === "killed"}>
                        Kill It
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openPromote(idea)}>
                        <ArrowRight className="h-3 w-3 mr-2" /> Promote →
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => openEdit(idea)}>
                        <Pencil className="h-3 w-3 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(idea)}>
                        <Trash2 className="h-3 w-3 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Capture modal */}
      <Dialog open={captureOpen} onOpenChange={(o) => { setCaptureOpen(o); if (!o) resetCapture(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Capture Idea</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="What's the idea?"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
            />
            <Textarea
              placeholder="Optional context — why does this matter?"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={3}
            />
            <Select value={newHorizon} onValueChange={setNewHorizon}>
              <SelectTrigger>
                <SelectValue placeholder="Time horizon (optional)" />
              </SelectTrigger>
              <SelectContent>
                {HORIZONS.map(h => (
                  <SelectItem key={h.key} value={h.key}>{h.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCaptureOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={!newTitle.trim() || busy}>Capture</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Idea</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} />
            <Select value={editHorizon} onValueChange={setEditHorizon}>
              <SelectTrigger>
                <SelectValue placeholder="Time horizon" />
              </SelectTrigger>
              <SelectContent>
                {HORIZONS.map(h => (
                  <SelectItem key={h.key} value={h.key}>{h.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={!editTitle.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promote modal */}
      <Dialog open={!!promoteIdea} onOpenChange={(o) => { if (!o) { setPromoteIdea(null); setPromoteTarget(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Promote This Idea</DialogTitle>
            <DialogDescription className="text-foreground font-medium pt-1">
              {promoteIdea?.title}
            </DialogDescription>
          </DialogHeader>

          {!promoteTarget ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">What does this become?</p>
              <div className="grid gap-2">
                {PROMOTE_TARGETS.map(t => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setPromoteTarget(t.key)}
                      className="flex items-start gap-3 text-left rounded-lg border border-border bg-card p-3 hover:border-primary/50 hover:bg-accent/50 transition"
                    >
                      <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{t.label}</p>
                        <p className="text-xs text-muted-foreground">{t.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Promoting to <span className="font-medium text-foreground">{PROMOTE_TARGETS.find(t => t.key === promoteTarget)?.label}</span>
                {" · "}
                <button onClick={() => setPromoteTarget(null)} className="text-primary hover:underline">change</button>
              </div>
              {promoteTarget === "business_plan" && (
                <div className="space-y-3">
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPromoteBizPlanMode("new")}
                      className={cn(
                        "flex-1 px-2.5 py-1.5 rounded-md text-xs font-medium border transition",
                        promoteBizPlanMode === "new" ? "bg-primary/10 border-primary/40 text-primary" : "border-border text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      New plan
                    </button>
                    <button
                      type="button"
                      onClick={() => setPromoteBizPlanMode("existing")}
                      className={cn(
                        "flex-1 px-2.5 py-1.5 rounded-md text-xs font-medium border transition",
                        promoteBizPlanMode === "existing" ? "bg-primary/10 border-primary/40 text-primary" : "border-border text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      Existing plan
                    </button>
                  </div>
                  {promoteBizPlanMode === "new" ? (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Plan name</label>
                      <Input value={promoteName} onChange={(e) => setPromoteName(e.target.value)} autoFocus />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Which plan?</label>
                      <Select value={promoteExistingPlanId || ""} onValueChange={setPromoteExistingPlanId}>
                        <SelectTrigger><SelectValue placeholder="Choose a plan" /></SelectTrigger>
                        <SelectContent>
                          {bizPlans.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {bizPlans.length === 0 && <p className="text-xs text-muted-foreground">No existing plans yet.</p>}
                    </div>
                  )}
                </div>
              )}
              {promoteTarget !== "roadmap" && promoteTarget !== "business_plan" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Name</label>
                  <Input value={promoteName} onChange={(e) => setPromoteName(e.target.value)} autoFocus />
                </div>
              )}
              {promoteTarget === "roadmap" && (
                <p className="text-sm text-muted-foreground italic">
                  This will be logged to your future roadmap. No record will be created yet.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setPromoteIdea(null); setPromoteTarget(null); }}>Cancel</Button>
            {promoteTarget && (
              <Button onClick={confirmPromote} disabled={promoting || promoteConfirmDisabled}>
                {promoting ? "Promoting…" : "Confirm"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        entityLabel="idea"
        entityName={deleteTarget?.title}
        requireType={false}
        onConfirm={() => deleteTarget && remove(deleteTarget.id)}
      />
    </div>
  );
}

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-full text-[11px] font-medium transition flex items-center gap-1.5",
        active ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"
      )}
    >
      {label} <span className="text-[10px] opacity-70">{count}</span>
    </button>
  );
}
