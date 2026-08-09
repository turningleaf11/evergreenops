import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Visibility, SharedWith } from "@/lib/mock-data";
import AccessPicker from "@/components/AccessPicker";
import { StatusPill, PriorityPill, AvatarStack, type AvatarStackPerson } from "@/components/primitives";
import { LinkOrCreate, type LinkCandidate } from "@/components/business-plans/LinkOrCreate";
import { CadencesTab } from "@/components/cadences/CadencesTab";
import GoalPeekWrapper from "@/components/mention-peek/peeks/GoalPeekWrapper";
import DocPeek from "@/components/mention-peek/peeks/DocPeek";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Target, Plus, Trash2, FileText, Layers, Compass, Users,
  ExternalLink, Link2, ChevronDown, X, Sparkles,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/shared/EmptyState";
import { format } from "date-fns";
import RichTextEditor from "@/components/RichTextEditor";
import { AlbusDraftDeliverablesSheet } from "@/components/business-plans/AlbusDraftDeliverables";

type BusinessPlan = {
  id: string; title: string; one_liner: string | null; status: string; priority: string; owner_id: string | null;
  visibility: string; shared_with: any; milestones: any[]; risks: any[]; plan_doc: string;
};
type Decision = { id: string; business_plan_id: string; text: string; decided_by: string | null; created_at: string };
type Deliverable = {
  id: string; business_plan_id: string; category: string; title: string; status: string;
  link_url: string | null; file_url: string | null; owner_id: string | null; due_date: string | null;
  linked_project_id: string | null; linked_task_id: string | null;
};
type RoleRow = { id: string; business_plan_id: string; role_title: string; assigned_user_id: string | null; notes: string | null };
type Goal = { id: string; title: string; status: string; quarter: string; year: number; measurable_target: string | null };
type DocRow = { id: string; title: string; updated_at: string };
type BoardRow = { id: string; title: string; updated_at: string };
type ProfileRow = { user_id: string; full_name: string | null; avatar_url: string | null; title: string | null };

const FREQ_LABELS: Record<string, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", custom: "Custom" };
const SEVERITIES = [
  { value: "high", label: "High", dot: "bg-destructive" },
  { value: "med", label: "Medium", dot: "bg-amber-500" },
  { value: "low", label: "Low", dot: "bg-muted-foreground" },
];

export default function BusinessPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [plan, setPlan] = useState<BusinessPlan | null>(null);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [boards, setBoards] = useState<BoardRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  // Unattached records available to link into this plan.
  const [freeGoals, setFreeGoals] = useState<LinkCandidate[]>([]);
  const [freeCadences, setFreeCadences] = useState<LinkCandidate[]>([]);
  const [freeDocs, setFreeDocs] = useState<LinkCandidate[]>([]);
  const [freeBoards, setFreeBoards] = useState<LinkCandidate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    const [planRes, delivRes, rolesRes, goalsRes, decisionsRes, docsRes, boardsRes, profRes,
           fGoals, fCad, fDocs, fBoards] = await Promise.all([
      supabase.from("business_plans").select("*").eq("id", id).single(),
      supabase.from("business_plan_deliverables").select("*").eq("business_plan_id", id).order("category").order("sort_order"),
      supabase.from("business_plan_roles").select("*").eq("business_plan_id", id).order("sort_order"),
      supabase.from("goals").select("id, title, status, quarter, year, measurable_target").eq("business_plan_id", id),
      supabase.from("business_plan_decisions").select("*").eq("business_plan_id", id).order("created_at", { ascending: false }),
      supabase.from("documents").select("id, title, updated_at").eq("business_plan_id", id),
      supabase.from("whiteboards").select("id, title, updated_at").eq("business_plan_id", id),
      supabase.from("profiles").select("user_id, full_name, avatar_url, title"),
      supabase.from("goals").select("id, title, quarter, year").is("business_plan_id", null).limit(100),
      supabase.from("cadences").select("id, title, schedule_type").is("business_plan_id", null).limit(100),
      supabase.from("documents").select("id, title, updated_at").is("business_plan_id", null).limit(100),
      supabase.from("whiteboards").select("id, title, updated_at").is("business_plan_id", null).limit(100),
    ]);
    setPlan(planRes.data as BusinessPlan);
    setDeliverables((delivRes.data as Deliverable[]) || []);
    setRoles((rolesRes.data as RoleRow[]) || []);
    setGoals((goalsRes.data as Goal[]) || []);
    setDecisions((decisionsRes.data as Decision[]) || []);
    setDocs((docsRes.data as DocRow[]) || []);
    setBoards((boardsRes.data as BoardRow[]) || []);
    setProfiles((profRes.data as ProfileRow[]) || []);
    setFreeGoals(((fGoals.data as any[]) || []).map((g) => ({ id: g.id, title: g.title, hint: `${g.quarter} ${g.year}` })));
    setFreeCadences(((fCad.data as any[]) || []).map((c) => ({ id: c.id, title: c.title, hint: FREQ_LABELS[c.schedule_type] || c.schedule_type })));
    setFreeDocs(((fDocs.data as any[]) || []).map((d) => ({ id: d.id, title: d.title })));
    setFreeBoards(((fBoards.data as any[]) || []).map((b) => ({ id: b.id, title: b.title })));
    setLoading(false);
  };

  useEffect(() => { void load(); }, [id]);

  if (loading) return <div className="p-8 text-sm text-muted-foreground text-center">Loading…</div>;
  if (!plan) return <div className="p-8"><EmptyState icon={Compass} title="Plan not found" description="It may have been deleted." /></div>;

  const updatePlan = async (patch: Partial<BusinessPlan>) => {
    setPlan((p) => (p ? { ...p, ...patch } : p));
    const { error } = await supabase.from("business_plans").update(patch as any).eq("id", plan.id);
    if (error) toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
  };

  /** Attach an existing record from another table to this plan. */
  const attach = async (table: "goals" | "cadences" | "documents" | "whiteboards", recordId: string) => {
    const { error } = await supabase.from(table).update({ business_plan_id: plan.id } as any).eq("id", recordId);
    if (error) { toast({ title: "Couldn't link", description: error.message, variant: "destructive" }); return; }
    await load();
  };
  /** Detach without deleting — the record goes back to living on its own. */
  const detach = async (table: "goals" | "cadences" | "documents" | "whiteboards", recordId: string) => {
    await supabase.from(table).update({ business_plan_id: null } as any).eq("id", recordId);
    await load();
  };

  const ownerProfile = profiles.find((p) => p.user_id === plan.owner_id);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight">{plan.title}</h1>
            <StatusPill kind="business_plan" value={plan.status} onChange={(v) => updatePlan({ status: v })} size="sm" />
            <PriorityPill value={plan.priority} onChange={(v) => updatePlan({ priority: v })} size="sm" />
          </div>
          {plan.one_liner && <p className="text-sm text-muted-foreground mt-1 max-w-xl">{plan.one_liner}</p>}
        </div>
        {ownerProfile && <AvatarStack people={[ownerProfile]} size="lg" />}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="plan">Plan</TabsTrigger>
          <TabsTrigger value="deliverables">Deliverables ({deliverables.filter((d) => d.status === "done").length}/{deliverables.length})</TabsTrigger>
          <TabsTrigger value="ops">Ops Support</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab
            plan={plan} goals={goals} freeGoals={freeGoals} decisions={decisions} profiles={profiles}
            onPlanPatch={updatePlan} onAttach={(gid) => attach("goals", gid)}
            onDetach={(gid) => detach("goals", gid)} onReload={load}
          />
        </TabsContent>
        <TabsContent value="plan" className="mt-4">
          <PlanDocTab
            planId={plan.id} content={plan.plan_doc || ""} profiles={profiles}
            onSave={(html) => updatePlan({ plan_doc: html })} onDeliverableAdded={load}
          />
        </TabsContent>
        <TabsContent value="deliverables" className="mt-4">
          <DeliverablesTab planId={plan.id} deliverables={deliverables} profiles={profiles} onChange={load} />
        </TabsContent>
        <TabsContent value="ops" className="mt-4">
          <OpsSupportTab planId={plan.id} freeCadences={freeCadences} onAttach={(cid) => attach("cadences", cid)} />
        </TabsContent>
        <TabsContent value="roles" className="mt-4">
          <RolesTab planId={plan.id} roles={roles} profiles={profiles} onChange={load} />
        </TabsContent>
        <TabsContent value="workspace" className="mt-4">
          <WorkspaceTab
            planId={plan.id} docs={docs} boards={boards} freeDocs={freeDocs} freeBoards={freeBoards}
            onAttach={attach} onDetach={detach} onReload={load}
            navigate={navigate} userId={user?.id || null}
          />
        </TabsContent>
        <TabsContent value="access" className="mt-4">
          <AccessTab plan={plan} onPlanPatch={updatePlan} ownerName={ownerProfile?.full_name || null} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────

function OverviewTab({ plan, goals, freeGoals, decisions, profiles, onPlanPatch, onAttach, onDetach, onReload }: {
  plan: BusinessPlan; goals: Goal[]; freeGoals: LinkCandidate[]; decisions: Decision[]; profiles: ProfileRow[];
  onPlanPatch: (p: Partial<BusinessPlan>) => void;
  onAttach: (goalId: string) => Promise<void>; onDetach: (goalId: string) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const { user } = useAuth();
  const [newMilestone, setNewMilestone] = useState("");
  const [newRisk, setNewRisk] = useState("");
  const [newRiskSeverity, setNewRiskSeverity] = useState("med");
  const [newDecision, setNewDecision] = useState("");
  const [goalPeekId, setGoalPeekId] = useState<string | null>(null);

  const milestones = plan.milestones || [];
  const risks = plan.risks || [];

  const addMilestone = () => {
    if (!newMilestone.trim()) return;
    onPlanPatch({ milestones: [...milestones, { title: newMilestone.trim(), done: false }] });
    setNewMilestone("");
  };
  const toggleMilestone = (idx: number) =>
    onPlanPatch({ milestones: milestones.map((m: any, i: number) => (i === idx ? { ...m, done: !m.done } : m)) });
  const removeMilestone = (idx: number) =>
    onPlanPatch({ milestones: milestones.filter((_: any, i: number) => i !== idx) });

  const addRisk = () => {
    if (!newRisk.trim()) return;
    onPlanPatch({ risks: [...risks, { text: newRisk.trim(), severity: newRiskSeverity }] });
    setNewRisk("");
    setNewRiskSeverity("med");
  };
  const setRiskSeverity = (idx: number, severity: string) =>
    onPlanPatch({ risks: risks.map((r: any, i: number) => (i === idx ? { ...r, severity } : r)) });
  const removeRisk = (idx: number) =>
    onPlanPatch({ risks: risks.filter((_: any, i: number) => i !== idx) });

  const createGoal = async (title: string) => {
    const now = new Date();
    const { error } = await supabase.from("goals").insert({
      title,
      quarter: `Q${Math.floor(now.getMonth() / 3) + 1}`, year: now.getFullYear(),
      status: "on_track", progress: 0,
      owner_id: user?.id || null, created_by: user?.id || null,
      business_plan_id: plan.id,
    });
    if (error) { toast({ title: "Couldn't create goal", description: error.message, variant: "destructive" }); return; }
    await onReload();
  };

  const addDecision = async () => {
    if (!newDecision.trim()) return;
    const { error } = await supabase.from("business_plan_decisions").insert({
      business_plan_id: plan.id, text: newDecision.trim(), decided_by: user?.id || null,
    });
    if (error) { toast({ title: "Couldn't log decision", description: error.message, variant: "destructive" }); return; }
    setNewDecision("");
    await onReload();
  };
  const removeDecision = async (decisionId: string) => {
    await supabase.from("business_plan_decisions").delete().eq("id", decisionId);
    await onReload();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Goals</h4>
              <LinkOrCreate noun="goal" candidates={freeGoals} onLink={onAttach} onCreate={createGoal} />
            </div>
            {goals.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                No goals yet — link an existing one from Execution Hub or create one here.
              </p>
            ) : (
              <div className="space-y-1.5">
                {goals.map((g) => (
                  <div key={g.id} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-border/40 last:border-0 group">
                    <button onClick={() => setGoalPeekId(g.id)} className="flex-1 min-w-0 text-left truncate hover:text-primary transition-colors">
                      {g.title}
                    </button>
                    {g.measurable_target && <span className="text-xs text-muted-foreground shrink-0">{g.measurable_target}</span>}
                    <StatusPill kind="goal" value={g.status} size="sm" />
                    <button onClick={() => onDetach(g.id)} title="Unlink from this plan" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <GoalPeekWrapper
          id={goalPeekId || ""}
          open={!!goalPeekId}
          onClose={() => { setGoalPeekId(null); onReload(); }}
        />

        <Card>
          <CardContent className="p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Milestones</h4>
            <div className="space-y-1.5">
              {milestones.map((m: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm group">
                  <input type="checkbox" checked={!!m.done} onChange={() => toggleMilestone(i)} className="h-3.5 w-3.5 accent-primary" />
                  <span className={m.done ? "line-through text-muted-foreground flex-1" : "flex-1"}>{m.title}</span>
                  <button onClick={() => removeMilestone(i)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-1.5 pt-1">
              <Input value={newMilestone} onChange={(e) => setNewMilestone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMilestone()} placeholder="Add a milestone…" className="h-7 text-xs" />
              <Button size="sm" variant="outline" className="h-7" onClick={addMilestone}>Add</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Risks &amp; blockers</h4>
          <div className="space-y-1.5">
            {risks.length === 0 && <p className="text-xs text-muted-foreground py-2">Nothing flagged.</p>}
            {risks.map((r: any, i: number) => {
              const sev = SEVERITIES.find((s) => s.value === (r.severity || "med")) || SEVERITIES[1];
              return (
                <div key={i} className="flex items-start gap-2 text-sm group">
                  <Select value={r.severity || "med"} onValueChange={(v) => setRiskSeverity(i, v)}>
                    <SelectTrigger className="h-6 w-[86px] text-[11px] shrink-0 mt-0.5">
                      <span className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                        {sev.label}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {SEVERITIES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          <span className="flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{s.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="flex-1 pt-1">{r.text}</span>
                  <button onClick={() => removeRisk(i)} className="opacity-0 group-hover:opacity-100 transition-opacity pt-1">
                    <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex gap-1.5 pt-1">
            <Select value={newRiskSeverity} onValueChange={setNewRiskSeverity}>
              <SelectTrigger className="h-7 w-[96px] text-xs shrink-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    <span className="flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{s.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={newRisk} onChange={(e) => setNewRisk(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRisk()} placeholder="Add a risk or blocker…" className="h-7 text-xs" />
            <Button size="sm" variant="outline" className="h-7" onClick={addRisk}>Add</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Decision log</h4>
          <div className="space-y-2.5">
            {decisions.length === 0 && <p className="text-xs text-muted-foreground py-2">Nothing logged yet — what changed, and why.</p>}
            {decisions.map((d) => {
              const who = profiles.find((p) => p.user_id === d.decided_by)?.full_name;
              return (
                <div key={d.id} className="flex items-start gap-2 text-sm group">
                  <div className="flex-1">
                    <p>{d.text}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {format(new Date(d.created_at), "MMM d, yyyy")}{who ? ` · ${who}` : ""}
                    </p>
                  </div>
                  <button onClick={() => removeDecision(d.id)} className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                    <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex gap-1.5 pt-1">
            <Textarea value={newDecision} onChange={(e) => setNewDecision(e.target.value)} placeholder="What changed, and why…" rows={1} className="text-xs min-h-7" />
            <Button size="sm" variant="outline" className="h-7 shrink-0" onClick={addDecision}>Log</Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

// ── Plan doc — an open page for notes/brainstorming, separate from the Wiki
// pages system. Autosaves like a scratch pad; "Ask Albus" reads it and
// proposes deliverables for review.

function PlanDocTab({ planId, content, profiles, onSave, onDeliverableAdded }: {
  planId: string; content: string; profiles: ProfileRow[];
  onSave: (html: string) => void; onDeliverableAdded: () => void;
}) {
  const [value, setValue] = useState(content);
  const [saving, setSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = (html: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaving(true);
    onSave(html);
    setSaving(false);
  };

  const handleChange = (html: string) => {
    setValue(html);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => flush(html), 1500);
  };

  const plainText = useMemo(() => {
    const div = document.createElement("div");
    div.innerHTML = value;
    return div.textContent || "";
  }, [value]);
  const isEmpty = plainText.trim().length < 3;

  const askAlbus = () => {
    flush(value); // make sure Albus reads the latest text, not a stale debounced version
    setSheetOpen(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-3">
        {saving && <span className="text-[10px] text-muted-foreground animate-pulse">Saving…</span>}
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={askAlbus} disabled={isEmpty}>
          <Sparkles className="h-3.5 w-3.5" /> Ask Albus
        </Button>
      </div>
      <div className="rounded-xl border shadow-sm bg-white dark:bg-card overflow-hidden">
        {/* RichTextEditor's root hardcodes bg-background (the app canvas token,
            darker than --card) — neutralize it here so the "paper" reads as one
            continuous surface instead of a darker box nested inside a lighter one. */}
        <div className="max-w-3xl mx-auto px-10 sm:px-16 py-12 min-h-[70vh] [&>.rich-editor]:bg-transparent">
          <RichTextEditor
            content={value}
            onChange={handleChange}
            borderless
            minHeight="55vh"
            placeholder="Start writing — notes, brain dump, ideas, whatever this venture needs…"
          />
        </div>
      </div>
      <AlbusDraftDeliverablesSheet
        planId={planId} open={sheetOpen} onOpenChange={setSheetOpen}
        profiles={profiles} onAccepted={onDeliverableAdded}
      />
    </div>
  );
}

// ── Deliverables ──────────────────────────────────────────────────────────

function DeliverablesTab({ planId, deliverables, profiles, onChange }: {
  planId: string; deliverables: Deliverable[]; profiles: ProfileRow[]; onChange: () => void;
}) {
  const { user } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");

  const grouped = useMemo(() => {
    const m = new Map<string, Deliverable[]>();
    deliverables.forEach((d) => { if (!m.has(d.category)) m.set(d.category, []); m.get(d.category)!.push(d); });
    return m;
  }, [deliverables]);

  const patch = async (d: Deliverable, values: Partial<Deliverable>) => {
    await supabase.from("business_plan_deliverables").update(values as any).eq("id", d.id);
    onChange();
  };

  const setLink = async (d: Deliverable) => {
    const url = window.prompt("Link URL", d.link_url || "");
    if (url === null) return;
    await patch(d, { link_url: url || null });
  };

  const promote = async (d: Deliverable, kind: "task" | "project") => {
    const table = kind === "task" ? "tasks" : "projects";
    const { data, error } = await supabase.from(table).insert({
      title: d.title,
      status: kind === "task" ? "todo" : "not_started",
      priority: "medium",
      business_plan_id: planId,
      created_by: user?.id || null,
      ...(kind === "task"
        ? { assigned_to: d.owner_id, due_date: d.due_date }
        : { owner_id: d.owner_id, due_date: d.due_date }),
    } as any).select("id").single();
    if (error || !data) { toast({ title: `Couldn't create ${kind}`, description: error?.message, variant: "destructive" }); return; }
    await patch(d, kind === "task" ? { linked_task_id: data.id } : { linked_project_id: data.id });
    toast({ title: `${kind === "task" ? "Task" : "Project"} created`, description: "Owner and due date carried over." });
  };

  const addDeliverable = async () => {
    if (!title.trim()) return;
    await supabase.from("business_plan_deliverables").insert({
      business_plan_id: planId, title: title.trim(), category: category.trim() || "General",
    });
    setAddOpen(false); setTitle(""); setCategory("General");
    onChange();
  };

  const remove = async (d: Deliverable) => {
    await supabase.from("business_plan_deliverables").delete().eq("id", d.id);
    onChange();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />Add deliverable</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New deliverable</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Buy box" /></div>
              <div className="space-y-1.5"><Label>Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Team Resources" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={addDeliverable} disabled={!title.trim()}>Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {deliverables.length === 0 ? (
        <EmptyState icon={Target} title="No deliverables yet" description="Add what this venture needs to operate — buy box, scripts, tools, whatever it takes." />
      ) : (
        Array.from(grouped.entries()).map(([cat, items]) => (
          <Card key={cat}>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{cat}</h4>
                <span className="text-[11px] text-muted-foreground tabular-nums">{items.filter((d) => d.status === "done").length}/{items.length}</span>
              </div>
              {items.map((d) => {
                const owner = profiles.find((p) => p.user_id === d.owner_id);
                const overdue = d.due_date && d.status !== "done" && new Date(d.due_date) < new Date();
                return (
                  <div key={d.id} className="flex items-center gap-2.5 py-2 border-b border-border/40 last:border-0 group">
                    <StatusPill kind="project" value={d.status} onChange={(v) => patch(d, { status: v })} size="sm" />
                    <span className={`flex-1 text-sm min-w-0 truncate ${d.status === "done" ? "text-muted-foreground line-through" : ""}`}>{d.title}</span>

                    {/* Owner */}
                    <Select value={d.owner_id || "__none__"} onValueChange={(v) => patch(d, { owner_id: v === "__none__" ? null : v })}>
                      <SelectTrigger className="h-6 w-[132px] text-[11px] shrink-0">
                        <SelectValue placeholder="Unassigned">
                          {owner ? owner.full_name : <span className="text-muted-foreground">Unassigned</span>}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Unassigned</SelectItem>
                        {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Unnamed"}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    {/* Due date */}
                    <Input
                      type="date"
                      value={d.due_date || ""}
                      onChange={(e) => patch(d, { due_date: e.target.value || null })}
                      className={`h-6 w-[126px] text-[11px] shrink-0 ${overdue ? "text-destructive border-destructive/50" : ""}`}
                    />

                    {d.link_url && (
                      <a href={d.link_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary shrink-0" title={d.link_url}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <Button size="sm" variant="ghost" className="h-6 text-[11px] px-1.5 shrink-0" onClick={() => setLink(d)}>
                      <Link2 className="h-3 w-3 mr-1" />{d.link_url ? "Edit" : "Link"}
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-6 text-[11px] px-1.5 shrink-0">
                          {d.linked_task_id || d.linked_project_id ? "Linked" : "Promote"} <ChevronDown className="h-3 w-3 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => promote(d, "task")} disabled={!!d.linked_task_id}>
                          {d.linked_task_id ? "Task already created" : "Promote to Task"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => promote(d, "project")} disabled={!!d.linked_project_id}>
                          {d.linked_project_id ? "Project already created" : "Promote to Project"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <button onClick={() => remove(d)} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

// ── Ops Support — the REAL Cadences tab, scoped to this plan ──────────────
//
// Same component Execution Hub uses (accent bar, streaks, complete/skip menu,
// full editor, peek) — CadencesTab takes an optional businessPlanId that
// filters its query and stamps new cadences, instead of a lookalike rebuild.
// A cadence created here is a normal cadence; it shows up in Execution Hub too.

function OpsSupportTab({ planId, freeCadences, onAttach }: {
  planId: string; freeCadences: LinkCandidate[]; onAttach: (id: string) => Promise<void>;
}) {
  const [tick, setTick] = useState(0);
  const linkExisting = async (cid: string) => {
    await onAttach(cid);
    setTick((t) => t + 1); // force CadencesTab (self-loading) to refetch
  };

  return (
    <div className="space-y-3">
      {freeCadences.length > 0 && (
        <div className="flex justify-end">
          <LinkOrCreate noun="cadence" candidates={freeCadences} onLink={linkExisting} onCreate={() => Promise.resolve()} allowCreate={false} />
        </div>
      )}
      <CadencesTab key={`${planId}-${tick}`} businessPlanId={planId} />
    </div>
  );
}

// ── Roles (mapped to the real roster) ─────────────────────────────────────

function RolesTab({ planId, roles, profiles, onChange }: {
  planId: string; roles: RoleRow[]; profiles: ProfileRow[]; onChange: () => void;
}) {
  // Role titles that already exist on the roster — so a plan's seats use the
  // same vocabulary as People rather than inventing parallel job names.
  const rosterTitles: LinkCandidate[] = useMemo(() => {
    const seen = new Map<string, number>();
    profiles.forEach((p) => {
      const t = (p.title || "").trim();
      if (t) seen.set(t, (seen.get(t) || 0) + 1);
    });
    return Array.from(seen.entries())
      .filter(([t]) => !roles.some((r) => r.role_title.toLowerCase() === t.toLowerCase()))
      .map(([t, n]) => ({ id: t, title: t, hint: `${n} on roster` }));
  }, [profiles, roles]);

  const addRole = async (roleTitle: string) => {
    // Pre-fill the assignee when exactly one person on the roster holds this title.
    const holders = profiles.filter((p) => (p.title || "").trim().toLowerCase() === roleTitle.trim().toLowerCase());
    await supabase.from("business_plan_roles").insert({
      business_plan_id: planId,
      role_title: roleTitle.trim(),
      assigned_user_id: holders.length === 1 ? holders[0].user_id : null,
    });
    onChange();
  };

  const assign = async (r: RoleRow, userId: string | null) => {
    await supabase.from("business_plan_roles").update({ assigned_user_id: userId }).eq("id", r.id);
    onChange();
  };

  const remove = async (r: RoleRow) => {
    await supabase.from("business_plan_roles").delete().eq("id", r.id);
    onChange();
  };

  const openSeats = roles.filter((r) => !r.assigned_user_id).length;

  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Roles</h4>
            {openSeats > 0 && (
              <Badge variant="secondary" className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/15">
                {openSeats} open seat{openSeats === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
          <LinkOrCreate noun="role" candidates={rosterTitles} onLink={addRole} onCreate={addRole} />
        </div>
        {roles.length === 0 ? (
          <EmptyState icon={Users} title="No roles defined" description="Pull a title from your roster or name a new seat — unfilled ones show up as hiring needs." card={false} size="sm" />
        ) : (
          roles.map((r) => {
            const person = profiles.find((p) => p.user_id === r.assigned_user_id);
            return (
              <div key={r.id} className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0 group">
                {person ? (
                  <AvatarStack people={[person]} size="md" />
                ) : (
                  <div className="h-[22px] w-[22px] rounded-full border border-dashed border-amber-500/60 flex items-center justify-center shrink-0">
                    <Users className="h-3 w-3 text-amber-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.role_title}</p>
                  {!person && <p className="text-[11px] text-amber-600">Open seat — nobody assigned</p>}
                </div>
                <Select value={r.assigned_user_id || "__none__"} onValueChange={(v) => assign(r, v === "__none__" ? null : v)}>
                  <SelectTrigger className="h-7 text-xs w-48 shrink-0">
                    <SelectValue>{person ? (person.full_name || "Unnamed") : "Unassigned"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {p.full_name || "Unnamed"}{p.title ? ` — ${p.title}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button onClick={() => remove(r)} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

// ── Workspace (Wiki, Whiteboards, Process Map stub) ───────────────────────

function WorkspaceTab({ planId, docs, boards, freeDocs, freeBoards, onAttach, onDetach, onReload, navigate, userId }: {
  planId: string; docs: DocRow[]; boards: BoardRow[]; freeDocs: LinkCandidate[]; freeBoards: LinkCandidate[];
  onAttach: (table: "goals" | "cadences" | "documents" | "whiteboards", id: string) => Promise<void>;
  onDetach: (table: "goals" | "cadences" | "documents" | "whiteboards", id: string) => Promise<void>;
  onReload: () => Promise<void>;
  navigate: (path: string) => void; userId: string | null;
}) {
  const [docPeekId, setDocPeekId] = useState<string | null>(null);

  const createDoc = async (title: string) => {
    const { data, error } = await supabase.from("documents").insert({
      title, content: "", tags: [], parent_id: null,
      visibility: "workspace", shared_with: { departmentIds: [], memberIds: [] },
      author_id: userId, business_plan_id: planId,
    } as any).select("id").single();
    if (error || !data) { toast({ title: "Couldn't create page", description: error?.message, variant: "destructive" }); return; }
    await onReload();
    setDocPeekId(data.id); // open it right here instead of navigating away
  };

  const createBoard = async (title: string) => {
    const { data, error } = await supabase.from("whiteboards").insert({
      title, created_by: userId, business_plan_id: planId,
    } as any).select("id").single();
    if (error || !data) { toast({ title: "Couldn't create board", description: error?.message, variant: "destructive" }); return; }
    navigate(`/whiteboards/${data.id}`);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Wiki pages</h4>
            <LinkOrCreate noun="page" candidates={freeDocs} onLink={(id) => onAttach("documents", id)} onCreate={createDoc} />
          </div>
          {docs.length === 0 ? <p className="text-xs text-muted-foreground py-2">No pages yet.</p> : docs.map((d) => (
            <div key={d.id} className="flex items-center gap-2 group">
              <button onClick={() => setDocPeekId(d.id)} className="flex-1 text-left flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors min-w-0">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-sm truncate">{d.title}</span>
              </button>
              <button onClick={() => onDetach("documents", d.id)} title="Unlink" className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
          {docPeekId && (
            <DocPeek id={docPeekId} open={!!docPeekId} onClose={() => { setDocPeekId(null); onReload(); }} variant="doc" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Whiteboards</h4>
            <LinkOrCreate noun="board" candidates={freeBoards} onLink={(id) => onAttach("whiteboards", id)} onCreate={createBoard} />
          </div>
          {boards.length === 0 ? <p className="text-xs text-muted-foreground py-2">No boards yet.</p> : boards.map((b) => (
            <div key={b.id} className="flex items-center gap-2 group">
              <button onClick={() => navigate(`/whiteboards/${b.id}`)} className="flex-1 text-left flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors min-w-0">
                <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-sm truncate">{b.title}</span>
              </button>
              <button onClick={() => onDetach("whiteboards", b.id)} title="Unlink" className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Process map</h4>
          <p className="text-xs text-muted-foreground py-1">A map scoped to this venture is coming — for now, open the shared Process Map.</p>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate("/process-map")}>
            <Compass className="h-3 w-3 mr-1" />Open Process Map
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Access ────────────────────────────────────────────────────────────────

function AccessTab({ plan, onPlanPatch, ownerName }: { plan: BusinessPlan; onPlanPatch: (p: Partial<BusinessPlan>) => void; ownerName: string | null; }) {
  const sharedWith: SharedWith = plan.shared_with || { departmentIds: [], memberIds: [] };
  return (
    <Card className="max-w-md">
      <CardContent className="p-4 space-y-4">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Owner</h4>
          <p className="text-sm">{ownerName || "Unassigned"}</p>
        </div>
        <AccessPicker
          visibility={plan.visibility as Visibility}
          sharedWith={sharedWith}
          onChange={(visibility, shared_with) => onPlanPatch({ visibility, shared_with })}
        />
      </CardContent>
    </Card>
  );
}
