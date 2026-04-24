import { useEffect, useMemo, useState } from "react";
import { Loader2, Briefcase, Plus, LayoutGrid, Table as TableIcon, ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { NewDealDialog } from "./NewDealDialog";
import { DealPeekSheet } from "./DealPeekSheet";
import { LostReasonDialog } from "./LostReasonDialog";
import { cn } from "@/lib/utils";
import { useViewPreference } from "@/hooks/useViewPreference";
import { formatDistanceToNow } from "date-fns";

interface Stage {
  id: string;
  pipeline_id: string;
  name: string;
  sort_order: number;
  color: string;
  is_won: boolean;
  is_lost: boolean;
}

interface Deal {
  id: string;
  title: string;
  stage_id: string;
  pipeline_id: string;
  value: number;
  currency: string;
  status: string;
  primary_contact_id: string | null;
  expected_close_date: string | null;
}

interface Pipeline {
  id: string;
  name: string;
  is_default: boolean;
}

const formatMoney = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

export function DealsKanban({ search }: { search: string }) {
  const { user } = useAuth();
  const { id: workspaceId } = useWorkspace();
  const [view, setView] = useViewPreference<"board" | "table">("crm:deals:view", "board");
  const [loading, setLoading] = useState(true);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [newOpen, setNewOpen] = useState(false);
  const [openDealId, setOpenDealId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverStageId, setHoverStageId] = useState<string | null>(null);
  const [pendingLost, setPendingLost] = useState<{ dealId: string; stageId: string } | null>(null);
  const [sortBy, setSortBy] = useState<"created" | "value" | "title" | "close" | "stage">("created");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: pls } = await supabase.from("pipelines").select("*").order("sort_order", { ascending: true });
      const list = (pls as Pipeline[]) || [];
      setPipelines(list);
      const def = list.find((p) => p.is_default) || list[0];
      setActivePipelineId(def?.id ?? null);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!activePipelineId) return;
    (async () => {
      const [{ data: st }, { data: dl }] = await Promise.all([
        supabase.from("pipeline_stages").select("*").eq("pipeline_id", activePipelineId).order("sort_order", { ascending: true }),
        supabase.from("deals").select("*").eq("pipeline_id", activePipelineId).order("created_at", { ascending: false }),
      ]);
      setStages((st as Stage[]) || []);
      setDeals((dl as Deal[]) || []);
    })();
  }, [activePipelineId, refreshKey]);

  const dealsByStage = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? deals.filter((d) => d.title.toLowerCase().includes(q)) : deals;
    const map = new Map<string, Deal[]>();
    stages.forEach((s) => map.set(s.id, []));
    filtered.forEach((d) => {
      const arr = map.get(d.stage_id);
      if (arr) arr.push(d);
    });
    return map;
  }, [deals, stages, search]);

  const totals = useMemo(() => {
    const open = deals.filter((d) => d.status === "open");
    const total = open.reduce((sum, d) => sum + Number(d.value || 0), 0);
    const won = deals.filter((d) => d.status === "won").reduce((s, d) => s + Number(d.value || 0), 0);
    return { total, won, openCount: open.length };
  }, [deals]);

  const moveDeal = async (dealId: string, newStageId: string, lostReason?: string) => {
    const stage = stages.find((s) => s.id === newStageId);
    if (!stage) return;
    const status = stage.is_won ? "won" : stage.is_lost ? "lost" : "open";
    const patch = {
      stage_id: newStageId,
      status,
      lost_reason: stage.is_lost ? (lostReason ?? null) : null,
    };

    // Optimistic
    setDeals((prev) => prev.map((d) => d.id === dealId ? { ...d, ...patch } : d));

    const { error } = await supabase.from("deals").update(patch).eq("id", dealId);
    if (error) {
      toast({ title: "Couldn't move deal", description: error.message, variant: "destructive" });
      setRefreshKey((k) => k + 1);
    }
  };

  const handleDrop = (stageId: string) => {
    if (!draggingId) return;
    const stage = stages.find((s) => s.id === stageId);
    const deal = deals.find((d) => d.id === draggingId);
    setDraggingId(null);
    setHoverStageId(null);
    if (!stage || !deal || deal.stage_id === stageId) return;
    if (stage.is_lost) {
      setPendingLost({ dealId: deal.id, stageId });
      return;
    }
    moveDeal(deal.id, stageId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading deals…
      </div>
    );
  }

  if (!activePipelineId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-sm text-muted-foreground">
        <Briefcase className="h-8 w-8 mb-3 opacity-50" />
        <p className="font-medium text-foreground mb-1">No pipelines configured</p>
        <p>An admin needs to create a pipeline first.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Forecast strip */}
      <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card px-4 py-3 text-sm gap-3">
        <div className="flex items-center gap-6">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Open</div>
            <div className="font-semibold">{formatMoney(totals.total)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Won</div>
            <div className="font-semibold text-emerald-600">{formatMoney(totals.won)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Open deals</div>
            <div className="font-semibold">{totals.openCount}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pipelines.length > 1 && (
            <select
              value={activePipelineId}
              onChange={(e) => setActivePipelineId(e.target.value)}
              className="text-xs bg-transparent border border-border/50 rounded px-2 py-1.5"
            >
              {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New deal
          </Button>
        </div>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(220px, 1fr))` }}>
        {stages.map((stage) => {
          const items = dealsByStage.get(stage.id) || [];
          const sum = items.reduce((s, d) => s + Number(d.value || 0), 0);
          const isHover = hoverStageId === stage.id;
          return (
            <div
              key={stage.id}
              onDragOver={(e) => { e.preventDefault(); setHoverStageId(stage.id); }}
              onDragLeave={() => setHoverStageId((h) => h === stage.id ? null : h)}
              onDrop={() => handleDrop(stage.id)}
              className={cn(
                "flex flex-col rounded-xl bg-muted/30 border border-border/30 min-h-[200px] transition-colors",
                isHover && "border-primary/50 bg-primary/5"
              )}
            >
              <div className="px-3 py-2 border-b border-border/30 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: `hsl(${stage.color})` }} />
                  <span className="text-xs font-medium truncate">{stage.name}</span>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{items.length}</span>
              </div>
              <div className="p-2 space-y-2 flex-1">
                {items.map((d) => (
                  <div
                    key={d.id}
                    draggable
                    onDragStart={() => setDraggingId(d.id)}
                    onDragEnd={() => { setDraggingId(null); setHoverStageId(null); }}
                    onClick={() => setOpenDealId(d.id)}
                    className={cn(
                      "rounded-lg border border-border/40 bg-card p-2.5 text-xs hover:shadow-sm hover:border-border transition-all cursor-pointer",
                      draggingId === d.id && "opacity-40"
                    )}
                  >
                    <p className="font-medium text-sm leading-snug line-clamp-2 mb-1">{d.title}</p>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>{formatMoney(Number(d.value || 0), d.currency)}</span>
                      {d.expected_close_date && (
                        <span className="text-[10px]">{new Date(d.expected_close_date).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="text-[11px] text-muted-foreground/60 text-center py-4">Drop here</div>
                )}
              </div>
              {items.length > 0 && (
                <div className="px-3 py-1.5 border-t border-border/30 text-[11px] text-muted-foreground flex justify-between">
                  <span>Total</span>
                  <span className="font-medium text-foreground">{formatMoney(sum)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <NewDealDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        pipelineId={activePipelineId}
        workspaceId={workspaceId}
        userId={user?.id ?? null}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />

      <DealPeekSheet
        dealId={openDealId}
        onClose={() => setOpenDealId(null)}
        onChanged={() => setRefreshKey((k) => k + 1)}
      />

      <LostReasonDialog
        open={!!pendingLost}
        onOpenChange={(v) => { if (!v) setPendingLost(null); }}
        onConfirm={(reason) => {
          if (pendingLost) moveDeal(pendingLost.dealId, pendingLost.stageId, reason);
          setPendingLost(null);
        }}
      />
    </div>
  );
}
