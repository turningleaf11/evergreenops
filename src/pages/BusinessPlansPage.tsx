import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { matchesVisibility } from "@/lib/visibility";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusPill } from "@/components/primitives";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ClipboardList, Plus, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/shared/EmptyState";

type BusinessPlan = {
  id: string;
  title: string;
  one_liner: string | null;
  status: string;
  owner_id: string | null;
  visibility: string;
  shared_with: any;
};

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function BusinessPlansPage() {
  const { isAdmin, user, profile } = useAuth();
  const navigate = useNavigate();

  const [plans, setPlans] = useState<BusinessPlan[]>([]);
  const [deliverableCounts, setDeliverableCounts] = useState<Record<string, { done: number; total: number }>>({});
  const [roleCounts, setRoleCounts] = useState<Record<string, { filled: number; total: number }>>({});
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null }>>({});
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newOneLiner, setNewOneLiner] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const [plansRes, deliverablesRes, rolesRes, profilesRes] = await Promise.all([
      supabase.from("business_plans").select("*").order("created_at", { ascending: false }),
      supabase.from("business_plan_deliverables").select("business_plan_id, status"),
      supabase.from("business_plan_roles").select("business_plan_id, assigned_user_id"),
      supabase.from("profiles").select("user_id, full_name"),
    ]);

    setPlans((plansRes.data as BusinessPlan[]) || []);

    const dCounts: Record<string, { done: number; total: number }> = {};
    (deliverablesRes.data || []).forEach((d: any) => {
      const bucket = dCounts[d.business_plan_id] || { done: 0, total: 0 };
      bucket.total += 1;
      if (d.status === "done") bucket.done += 1;
      dCounts[d.business_plan_id] = bucket;
    });
    setDeliverableCounts(dCounts);

    const rCounts: Record<string, { filled: number; total: number }> = {};
    (rolesRes.data || []).forEach((r: any) => {
      const bucket = rCounts[r.business_plan_id] || { filled: 0, total: 0 };
      bucket.total += 1;
      if (r.assigned_user_id) bucket.filled += 1;
      rCounts[r.business_plan_id] = bucket;
    });
    setRoleCounts(rCounts);

    const profileMap: Record<string, { full_name: string | null }> = {};
    (profilesRes.data || []).forEach((p: any) => { profileMap[p.user_id] = { full_name: p.full_name }; });
    setProfiles(profileMap);

    setLoading(false);
  }

  const visiblePlans = useMemo(() => {
    return plans.filter((p) =>
      matchesVisibility(
        { visibility: p.visibility, sharedWith: p.shared_with, authorId: p.owner_id },
        { isAdmin, userId: user?.id, departmentId: profile?.department_id }
      )
    );
  }, [plans, isAdmin, user?.id, profile?.department_id]);

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
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visiblePlans.map((plan) => {
            const dCount = deliverableCounts[plan.id] || { done: 0, total: 0 };
            const rCount = roleCounts[plan.id] || { filled: 0, total: 0 };
            const progress = dCount.total > 0 ? Math.round((dCount.done / dCount.total) * 100) : 0;
            const memberIds: string[] = plan.shared_with?.memberIds || [];
            const ownerName = plan.owner_id ? (profiles[plan.owner_id]?.full_name || "Unassigned") : "Unassigned";

            return (
              <Card
                key={plan.id}
                onClick={() => navigate(`/business-plans/${plan.id}`)}
                className="cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all group border-border/50 bg-card/60 backdrop-blur-sm"
              >
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-2">
                        {plan.title}
                      </h3>
                      {plan.one_liner && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{plan.one_liner}</p>
                      )}
                    </div>
                    <StatusPill kind="business_plan" value={plan.status} size="sm" />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Deliverables</span>
                      <span className="font-medium">{dCount.done}/{dCount.total}</span>
                    </div>
                    <Progress value={progress} className="h-1" />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3 w-3" />
                      {rCount.total === 0 ? "No roles set" : `${rCount.total - rCount.filled} open role${rCount.total - rCount.filled === 1 ? "" : "s"}`}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-4 w-4 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[8px] font-semibold">
                        {getInitials(ownerName)}
                      </span>
                      {memberIds.length > 0 && <span>+{memberIds.length}</span>}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
