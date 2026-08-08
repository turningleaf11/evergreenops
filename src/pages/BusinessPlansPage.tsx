import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { matchesVisibility } from "@/lib/visibility";
import { Button } from "@/components/ui/button";
import { EntityCard, type AvatarStackPerson } from "@/components/primitives";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ClipboardList, Plus, CheckSquare, UserPlus, Repeat } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/shared/EmptyState";

type BusinessPlan = {
  id: string;
  title: string;
  one_liner: string | null;
  status: string;
  priority: string;
  owner_id: string | null;
  visibility: string;
  shared_with: any;
};

type ProfileLite = { user_id: string; full_name: string | null; avatar_url: string | null };

// Same scale tasks/projects use (src/lib/statusTone.ts) — most-urgent first,
// so the venture that's the actual strategic focus surfaces at the top.
const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export default function BusinessPlansPage() {
  const { isAdmin, user, profile } = useAuth();
  const navigate = useNavigate();

  const [plans, setPlans] = useState<BusinessPlan[]>([]);
  const [deliverableCounts, setDeliverableCounts] = useState<Record<string, { done: number; total: number }>>({});
  const [roleCounts, setRoleCounts] = useState<Record<string, { open: number; total: number }>>({});
  const [cadenceCounts, setCadenceCounts] = useState<Record<string, number>>({});
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newOneLiner, setNewOneLiner] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const [plansRes, deliverablesRes, rolesRes, cadencesRes, profilesRes] = await Promise.all([
      supabase.from("business_plans").select("*").order("created_at", { ascending: false }),
      supabase.from("business_plan_deliverables").select("business_plan_id, status"),
      supabase.from("business_plan_roles").select("business_plan_id, assigned_user_id"),
      supabase.from("cadences").select("business_plan_id").not("business_plan_id", "is", null),
      supabase.from("profiles").select("user_id, full_name, avatar_url"),
    ]);

    setPlans((plansRes.data as BusinessPlan[]) || []);

    const dCounts: Record<string, { done: number; total: number }> = {};
    (deliverablesRes.data || []).forEach((d: any) => {
      const b = dCounts[d.business_plan_id] || { done: 0, total: 0 };
      b.total += 1;
      if (d.status === "done") b.done += 1;
      dCounts[d.business_plan_id] = b;
    });
    setDeliverableCounts(dCounts);

    const rCounts: Record<string, { open: number; total: number }> = {};
    (rolesRes.data || []).forEach((r: any) => {
      const b = rCounts[r.business_plan_id] || { open: 0, total: 0 };
      b.total += 1;
      if (!r.assigned_user_id) b.open += 1;
      rCounts[r.business_plan_id] = b;
    });
    setRoleCounts(rCounts);

    const cCounts: Record<string, number> = {};
    (cadencesRes.data || []).forEach((c: any) => {
      cCounts[c.business_plan_id] = (cCounts[c.business_plan_id] || 0) + 1;
    });
    setCadenceCounts(cCounts);

    const profileMap: Record<string, ProfileLite> = {};
    (profilesRes.data || []).forEach((p: any) => { profileMap[p.user_id] = p; });
    setProfiles(profileMap);

    setLoading(false);
  }

  const visiblePlans = useMemo(() =>
    plans
      .filter((p) =>
        matchesVisibility(
          { visibility: p.visibility, sharedWith: p.shared_with, authorId: p.owner_id },
          { isAdmin, userId: user?.id, departmentId: profile?.department_id }
        )
      )
      .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2)),
    [plans, isAdmin, user?.id, profile?.department_id]);

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("business_plans")
      .insert({
        title: newTitle.trim(),
        one_liner: newOneLiner.trim() || null,
        status: "planning",
        owner_id: user?.id || null,
        created_by: user?.id || null,
      })
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) {
      toast({ title: "Couldn't create plan", description: error?.message, variant: "destructive" });
      return;
    }
    setCreateOpen(false);
    setNewTitle("");
    setNewOneLiner("");
    navigate(`/business-plans/${data.id}`);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary/70" />
            Business Plans
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Every active venture, one page each — deliverables, roles, target, and ops support.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New plan</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New business plan</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="bp-title">Name</Label>
                <Input id="bp-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Fix & Flip" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bp-oneliner">One-liner</Label>
                <Textarea id="bp-oneliner" value={newOneLiner} onChange={(e) => setNewOneLiner(e.target.value)} placeholder="What this business line does, in a sentence" rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!newTitle.trim() || creating}>{creating ? "Creating…" : "Create plan"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
      ) : visiblePlans.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No business plans yet"
          description="Create one for each venture — Fix & Flip, Buy & Hold, or anything else you're building."
          actionLabel="New plan"
          actionIcon={Plus}
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visiblePlans.map((plan) => {
            const d = deliverableCounts[plan.id] || { done: 0, total: 0 };
            const r = roleCounts[plan.id] || { open: 0, total: 0 };
            const cadences = cadenceCounts[plan.id] || 0;

            // Owner first, then anyone the plan is explicitly shared with.
            const people: AvatarStackPerson[] = [];
            if (plan.owner_id && profiles[plan.owner_id]) people.push(profiles[plan.owner_id]);
            ((plan.shared_with?.memberIds as string[]) || []).forEach((uid) => {
              if (uid !== plan.owner_id && profiles[uid]) people.push(profiles[uid]);
            });

            return (
              <EntityCard
                key={plan.id}
                kind="business_plan"
                status={plan.status}
                priority={plan.priority}
                title={plan.title}
                description={plan.one_liner}
                assignees={people}
                onClick={() => navigate(`/business-plans/${plan.id}`)}
                metadata={[
                  { icon: CheckSquare, value: `${d.done}/${d.total}`, label: "Deliverables ready" },
                  { icon: UserPlus, value: r.open, label: "Open roles" },
                  { icon: Repeat, value: cadences, label: "Ops cadences" },
                ]}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
