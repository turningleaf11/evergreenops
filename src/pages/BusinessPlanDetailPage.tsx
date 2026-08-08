import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Visibility, SharedWith } from "@/lib/mock-data";
import AccessPicker from "@/components/AccessPicker";
import { StatusPill } from "@/components/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Target, Plus, Trash2, FileText, Layers, Compass, Users, Repeat,
  ExternalLink, Link2, ChevronDown, X,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/shared/EmptyState";

type BusinessPlan = {
  id: string; title: string; one_liner: string | null; status: string; owner_id: string | null;
  visibility: string; shared_with: any; milestones: any[]; risks: any[];
};
type Deliverable = {
  id: string; business_plan_id: string; category: string; title: string; status: string;
  link_url: string | null; file_url: string | null; linked_project_id: string | null; linked_task_id: string | null;
};
type RoleRow = { id: string; business_plan_id: string; role_title: string; assigned_user_id: string | null; notes: string | null };
type Goal = { id: string; title: string; status: string; quarter: string; year: number; measurable_target: string | null };
type Cadence = { id: string; title: string; description: string | null; schedule_type: string; owner_id: string | null; is_active: boolean };
type DocRow = { id: string; title: string; updated_at: string };
type BoardRow = { id: string; title: string; updated_at: string };
type ProfileRow = { user_id: string; full_name: string | null };

const FREQ_LABELS: Record<string, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", custom: "Custom" };

export default function BusinessPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const [plan, setPlan] = useState<BusinessPlan | null>(null);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [cadences, setCadences] = useState<Cadence[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [boards, setBoards] = useState<BoardRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  const nameFor = (uid: string | null) => (uid ? profiles.find((p) => p.user_id === uid)?.full_name || "Unknown" : null);

  const load = async () => {
    if (!id) return;
    const [planRes, delivRes, rolesRes, goalsRes, cadRes, docsRes, boardsRes, profRes] = await Promise.all([
      supabase.from("business_plans").select("*").eq("id", id).single(),
      supabase.from("business_plan_deliverables").select("*").eq("business_plan_id", id).order("category").order("sort_order"),
      supabase.from("business_plan_roles").select("*").eq("business_plan_id", id).order("sort_order"),
      supabase.from("goals").select("id, title, status, quarter, year, measurable_target").eq("business_plan_id", id),
      supabase.from("cadences").select("id, title, description, schedule_type, owner_id, is_active").eq("business_plan_id", id),
      supabase.from("documents").select("id, title, updated_at").eq("business_plan_id", id),
      supabase.from("whiteboards").select("id, title, updated_at").eq("business_plan_id", id),
      supabase.from("profiles").select("user_id, full_name"),
    ]);
    setPlan(planRes.data as BusinessPlan);
    setDeliverables((delivRes.data as Deliverable[]) || []);
    setRoles((rolesRes.data as RoleRow[]) || []);
    setGoals((goalsRes.data as Goal[]) || []);
    setCadences((cadRes.data as Cadence[]) || []);
    setDocs((docsRes.data as DocRow[]) || []);
    setBoards((boardsRes.data as BoardRow[]) || []);
    setProfiles((profRes.data as ProfileRow[]) || []);
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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight">{plan.title}</h1>
            <StatusPill kind="business_plan" value={plan.status} onChange={(v) => updatePlan({ status: v })} size="sm" />
          </div>
          {plan.one_liner && <p className="text-sm text-muted-foreground mt-1 max-w-xl">{plan.one_liner}</p>}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deliverables">Deliverables ({deliverables.filter((d) => d.status === "done").length}/{deliverables.length})</TabsTrigger>
          <TabsTrigger value="ops">Ops Support</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab plan={plan} goals={goals} onPlanPatch={updatePlan} onGoalCreated={load} />
        </TabsContent>
        <TabsContent value="deliverables" className="mt-4">
          <DeliverablesTab planId={plan.id} deliverables={deliverables} onChange={load} />
        </TabsContent>
        <TabsContent value="ops" className="mt-4">
          <OpsSupportTab planId={plan.id} cadences={cadences} profiles={profiles} onChange={load} />
        </TabsContent>
        <TabsContent value="roles" className="mt-4">
          <RolesTab planId={plan.id} roles={roles} profiles={profiles} onChange={load} />
        </TabsContent>
        <TabsContent value="workspace" className="mt-4">
          <WorkspaceTab planId={plan.id} docs={docs} boards={boards} onChange={load} navigate={navigate} userId={user?.id || null} />
        </TabsContent>
        <TabsContent value="access" className="mt-4">
          <AccessTab plan={plan} onPlanPatch={updatePlan} ownerName={nameFor(plan.owner_id)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────

function OverviewTab({ plan, goals, onPlanPatch, onGoalCreated }: {
  plan: BusinessPlan; goals: Goal[]; onPlanPatch: (p: Partial<BusinessPlan>) => void; onGoalCreated: () => void;
}) {
  const { user } = useAuth();
  const [newMilestone, setNewMilestone] = useState("");
  const [newRisk, setNewRisk] = useState("");
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [creatingGoal, setCreatingGoal] = useState(false);

  const milestones = plan.milestones || [];
  const risks = plan.risks || [];

  const addMilestone = () => {
    if (!newMilestone.trim()) return;
    onPlanPatch({ milestones: [...milestones, { title: newMilestone.trim(), done: false }] });
    setNewMilestone("");
  };
  const toggleMilestone = (idx: number) => {
    const next = milestones.map((m: any, i: number) => (i === idx ? { ...m, done: !m.done } : m));
    onPlanPatch({ milestones: next });
  };
  const removeMilestone = (idx: number) => onPlanPatch({ milestones: milestones.filter((_: any, i: number) => i !== idx) });

  const addRisk = () => {
    if (!newRisk.trim()) return;
    onPlanPatch({ risks: [...risks, { text: newRisk.trim(), severity: "med" }] });
    setNewRisk("");
  };
  const removeRisk = (idx: number) => onPlanPatch({ risks: risks.filter((_: any, i: number) => i !== idx) });

  const createGoal = async () => {
    if (!goalTitle.trim()) return;
    setCreatingGoal(true);
    const now = new Date();
    const quarter = `Q${Math.floor(now.getMonth() / 3) + 1}`;
    const { error } = await supabase.from("goals").insert({
      title: goalTitle.trim(),
      measurable_target: goalTarget.trim() || null,
      quarter, year: now.getFullYear(),
      status: "on_track", progress: 0,
      owner_id: user?.id || null, created_by: user?.id || null,
      business_plan_id: plan.id,
    });
    setCreatingGoal(false);
    if (error) { toast({ title: "Couldn't create goal", description: error.message, variant: "destructive" }); return; }
    setGoalOpen(false); setGoalTitle(""); setGoalTarget("");
    onGoalCreated();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Goals</h4>
              <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
                <DialogTrigger asChild><Button size="sm" variant="outline" className="h-7 text-xs"><Plus className="h-3 w-3 mr-1" />New goal</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New goal for {plan.title}</DialogTitle></DialogHeader>
                  <div className="space-y-3 py-2">
                    <div className="space-y-1.5"><Label>Title</Label><Input value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} placeholder="e.g. 10 offers a week" /></div>
                    <div className="space-y-1.5"><Label>Measurable target</Label><Input value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} placeholder="e.g. 10/week" /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setGoalOpen(false)}>Cancel</Button>
                    <Button onClick={createGoal} disabled={!goalTitle.trim() || creatingGoal}>{creatingGoal ? "Creating…" : "Create goal"}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {goals.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No goals linked yet.</p>
            ) : (
              <div className="space-y-1.5">
                {goals.map((g) => (
                  <div key={g.id} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-border/40 last:border-0">
                    <span className="flex-1 min-w-0 truncate">{g.title}</span>
                    {g.measurable_target && <span className="text-xs text-muted-foreground shrink-0">{g.measurable_target}</span>}
                    <StatusPill kind="goal" value={g.status} size="sm" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Milestones</h4>
            <div className="space-y-1.5">
              {milestones.map((m: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm group">
                  <input type="checkbox" checked={!!m.done} onChange={() => toggleMilestone(i)} className="h-3.5 w-3.5" />
                  <span className={m.done ? "line-through text-muted-foreground flex-1" : "flex-1"}>{m.title}</span>
                  <button onClick={() => removeMilestone(i)} className="opacity-0 group-hover:opacity-100"><X className="h-3 w-3 text-muted-foreground" /></button>
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

      <Card>
        <CardContent className="p-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Risks &amp; blockers</h4>
          <div className="space-y-1.5">
            {risks.length === 0 && <p className="text-xs text-muted-foreground py-2">Nothing flagged.</p>}
            {risks.map((r: any, i: number) => (
              <div key={i} className="flex items-start gap-2 text-sm group">
                <span className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${r.severity === "high" ? "bg-destructive" : "bg-amber-500"}`} />
                <span className="flex-1">{r.text}</span>
                <button onClick={() => removeRisk(i)} className="opacity-0 group-hover:opacity-100"><X className="h-3 w-3 text-muted-foreground" /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 pt-1">
            <Input value={newRisk} onChange={(e) => setNewRisk(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRisk()} placeholder="Add a risk or blocker…" className="h-7 text-xs" />
            <Button size="sm" variant="outline" className="h-7" onClick={addRisk}>Add</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Deliverables ──────────────────────────────────────────────────────────

function DeliverablesTab({ planId, deliverables, onChange }: { planId: string; deliverables: Deliverable[]; onChange: () => void; }) {
  const { user } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");

  const grouped = useMemo(() => {
    const m = new Map<string, Deliverable[]>();
    deliverables.forEach((d) => { if (!m.has(d.category)) m.set(d.category, []); m.get(d.category)!.push(d); });
    return m;
  }, [deliverables]);

  const setStatus = async (d: Deliverable, status: string) => {
    await supabase.from("business_plan_deliverables").update({ status }).eq("id", d.id);
    onChange();
  };

  const setLink = async (d: Deliverable) => {
    const url = window.prompt("Link URL", d.link_url || "");
    if (url === null) return;
    await supabase.from("business_plan_deliverables").update({ link_url: url || null }).eq("id", d.id);
    onChange();
  };

  const promote = async (d: Deliverable, kind: "task" | "project") => {
    const table = kind === "task" ? "tasks" : "projects";
    const { data, error } = await supabase.from(table).insert({
      title: d.title, status: kind === "task" ? "todo" : "not_started", priority: "medium",
      business_plan_id: planId, created_by: user?.id || null,
    } as any).select("id").single();
    if (error || !data) { toast({ title: `Couldn't create ${kind}`, description: error?.message, variant: "destructive" }); return; }
    await supabase.from("business_plan_deliverables").update(
      kind === "task" ? { linked_task_id: data.id } : { linked_project_id: data.id }
    ).eq("id", d.id);
    toast({ title: `${kind === "task" ? "Task" : "Project"} created` });
    onChange();
  };

  const addDeliverable = async () => {
    if (!title.trim()) return;
    await supabase.from("business_plan_deliverables").insert({ business_plan_id: planId, title: title.trim(), category: category.trim() || "General" });
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
                <span className="text-[11px] text-muted-foreground">{items.filter((d) => d.status === "done").length}/{items.length}</span>
              </div>
              {items.map((d) => (
                <div key={d.id} className="flex items-center gap-2.5 py-2 border-b border-border/40 last:border-0 group">
                  <StatusPill kind="project" value={d.status} onChange={(v) => setStatus(d, v)} size="sm" />
                  <span className={`flex-1 text-sm min-w-0 truncate ${d.status === "done" ? "text-muted-foreground line-through" : ""}`}>{d.title}</span>
                  {d.link_url && <a href={d.link_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary"><ExternalLink className="h-3.5 w-3.5" /></a>}
                  <Button size="sm" variant="ghost" className="h-6 text-[11px] px-1.5" onClick={() => setLink(d)}>
                    <Link2 className="h-3 w-3 mr-1" />{d.link_url ? "Edit link" : "Add link"}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-6 text-[11px] px-1.5">
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
                  <button onClick={() => remove(d)} className="opacity-0 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

// ── Ops Support (Cadences, scoped) ───────────────────────────────────────

function OpsSupportTab({ planId, cadences, profiles, onChange }: {
  planId: string; cadences: Cadence[]; profiles: ProfileRow[]; onChange: () => void;
}) {
  const { user } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [schedule, setSchedule] = useState("weekly");

  const addCadence = async () => {
    if (!title.trim()) return;
    await supabase.from("cadences").insert({
      title: title.trim(), schedule_type: schedule, is_active: true,
      business_plan_id: planId, created_by: user?.id || null,
    } as any);
    setAddOpen(false); setTitle(""); setSchedule("weekly");
    onChange();
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recurring ops support</h4>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild><Button size="sm" variant="outline" className="h-7 text-xs"><Plus className="h-3 w-3 mr-1" />New cadence</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New recurring cadence</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. QA on calls" /></div>
                <div className="space-y-1.5">
                  <Label>Frequency</Label>
                  <Select value={schedule} onValueChange={setSchedule}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(FREQ_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button onClick={addCadence} disabled={!title.trim()}>Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        {cadences.length === 0 ? (
          <EmptyState icon={Repeat} title="No ops support set up" description="Campaign monitoring, QA, email coverage — anything recurring this venture needs." card={false} size="sm" />
        ) : (
          cadences.map((c) => {
            const owner = c.owner_id ? profiles.find((p) => p.user_id === c.owner_id)?.full_name : null;
            return (
              <div key={c.id} className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0">
                <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0"><Repeat className="h-3.5 w-3.5 text-muted-foreground" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.title}</p>
                  {c.description && <p className="text-xs text-muted-foreground truncate">{c.description}</p>}
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{FREQ_LABELS[c.schedule_type] || c.schedule_type}</span>
                <span className={`text-xs shrink-0 ${owner ? "text-muted-foreground" : "text-amber-600"}`}>{owner || "Unassigned"}</span>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

// ── Roles ─────────────────────────────────────────────────────────────────

function RolesTab({ planId, roles, profiles, onChange }: {
  planId: string; roles: RoleRow[]; profiles: ProfileRow[]; onChange: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("");

  const addRole = async () => {
    if (!title.trim()) return;
    await supabase.from("business_plan_roles").insert({ business_plan_id: planId, role_title: title.trim() });
    setAddOpen(false); setTitle("");
    onChange();
  };

  const assign = async (r: RoleRow, userId: string) => {
    await supabase.from("business_plan_roles").update({ assigned_user_id: userId || null }).eq("id", r.id);
    onChange();
  };

  const remove = async (r: RoleRow) => {
    await supabase.from("business_plan_roles").delete().eq("id", r.id);
    onChange();
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Roles</h4>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild><Button size="sm" variant="outline" className="h-7 text-xs"><Plus className="h-3 w-3 mr-1" />Add role</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New role</DialogTitle></DialogHeader>
              <div className="space-y-1.5 py-2"><Label>Role title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Acquisitions Manager" /></div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button onClick={addRole} disabled={!title.trim()}>Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        {roles.length === 0 ? (
          <EmptyState icon={Users} title="No roles defined" description="Name what this venture needs staffed — you can assign people later." card={false} size="sm" />
        ) : (
          roles.map((r) => (
            <div key={r.id} className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0 group">
              <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0"><Users className="h-3.5 w-3.5 text-muted-foreground" /></div>
              <span className="flex-1 text-sm font-medium min-w-0 truncate">{r.role_title}</span>
              <Select value={r.assigned_user_id || "__none__"} onValueChange={(v) => assign(r, v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-7 text-xs w-44"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Unnamed"}</SelectItem>)}
                </SelectContent>
              </Select>
              <button onClick={() => remove(r)} className="opacity-0 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ── Workspace (Wiki, Whiteboards, Process Map stub, Files) ─────────────────

function WorkspaceTab({ planId, docs, boards, onChange, navigate, userId }: {
  planId: string; docs: DocRow[]; boards: BoardRow[]; onChange: () => void; navigate: (path: string) => void; userId: string | null;
}) {
  const newDoc = async () => {
    const { data, error } = await supabase.from("documents").insert({
      title: "Untitled", content: "", tags: [], parent_id: null,
      visibility: "workspace", shared_with: { departmentIds: [], memberIds: [] },
      author_id: userId, business_plan_id: planId,
    } as any).select("id").single();
    if (error || !data) { toast({ title: "Couldn't create page", description: error?.message, variant: "destructive" }); return; }
    navigate(`/docs?id=${data.id}`);
  };

  const newBoard = async () => {
    const { data, error } = await supabase.from("whiteboards").insert({
      title: "Untitled Whiteboard", created_by: userId, business_plan_id: planId,
    } as any).select("id").single();
    if (error || !data) { toast({ title: "Couldn't create board", description: error?.message, variant: "destructive" }); return; }
    navigate(`/whiteboards/${data.id}`);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between"><h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Wiki pages</h4></div>
          {docs.length === 0 ? <p className="text-xs text-muted-foreground py-2">No pages yet.</p> : docs.map((d) => (
            <button key={d.id} onClick={() => navigate(`/docs?id=${d.id}`)} className="w-full text-left flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-sm truncate">{d.title}</span>
            </button>
          ))}
          <Button size="sm" variant="outline" className="h-7 text-xs mt-1" onClick={newDoc}><Plus className="h-3 w-3 mr-1" />New page</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Whiteboards</h4>
          {boards.length === 0 ? <p className="text-xs text-muted-foreground py-2">No boards yet.</p> : boards.map((b) => (
            <button key={b.id} onClick={() => navigate(`/whiteboards/${b.id}`)} className="w-full text-left flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors">
              <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-sm truncate">{b.title}</span>
            </button>
          ))}
          <Button size="sm" variant="outline" className="h-7 text-xs mt-1" onClick={newBoard}><Plus className="h-3 w-3 mr-1" />New board</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Process map</h4>
          <p className="text-xs text-muted-foreground py-1">Embedding a scoped map here is coming soon — for now, open the shared Process Map.</p>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate("/process-map")}><Compass className="h-3 w-3 mr-1" />Open Process Map</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Files</h4>
          <p className="text-xs text-muted-foreground py-1">File uploads aren't wired up yet — use a wiki page or link on a deliverable for now.</p>
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
