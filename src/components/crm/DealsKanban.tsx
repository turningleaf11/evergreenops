import { useEffect, useMemo, useState } from "react";
import { Loader2, Briefcase, Plus, LayoutGrid, Table as TableIcon, ArrowUpDown, Clock } from "lucide-react";
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
import { DataTableShell, DataTableHeader, DataTableRow, DataTablePill, DataTableEmpty } from "@/components/ui/data-table-shell";
import { InlinePopoverCell, InlineOptionList, InlineTextCell, InlineDateCell } from "./InlineCellEditors";
import { EntityCard } from "@/components/primitives";

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
  created_at?: string;
  property_address?: string | null;
  property_type?: string | null;
  asking_price?: number | null;
  owner_id?: string | null;
  source_contact_id?: string | null;
  stage_entered_at?: string | null;
  cover_url?: string | null;
}

interface PersonLite { user_id: string; full_name: string | null; avatar_url: string | null }
interface ContactLite { id: string; first_name: string | null; last_name: string | null }

interface Pipeline {
  id: string;
  name: string;
  is_default: boolean;
}

const formatMoney = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

export function DealsKanban({ search, newSignal = 0 }: { search: string; newSignal?: number }) {
  const { user } = useAuth();
  const { id: workspaceId } = useWorkspace();
  const [view, setView] = useViewPreference<"board" | "table">("crm:deals:view", "board");
  const [loading, setLoading] = useState(true);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [people, setPeople] = useState<PersonLite[]>([]);
  const [sourceContacts, setSourceContacts] = useState<ContactLite[]>([]);
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
      const { data: ps } = await supabase.from("profiles").select("user_id,full_name,avatar_url").limit(500);
      setPeople((ps as PersonLite[]) || []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (newSignal > 0) setNewOpen(true);
  }, [newSignal]);

  useEffect(() => {
    if (!activePipelineId) return;
    (async () => {
      const [{ data: st }, { data: dl }] = await Promise.all([
        supabase.from("pipeline_stages").select("*").eq("pipeline_id", activePipelineId).order("sort_order", { ascending: true }),
        supabase.from("deals").select("*").eq("pipeline_id", activePipelineId).order("created_at", { ascending: false }),
      ]);
      setStages((st as Stage[]) || []);
      const dealRows = (dl as Deal[]) || [];
      setDeals(dealRows);
      const contactIds = Array.from(
        new Set(dealRows.map((d) => d.source_contact_id).filter(Boolean) as string[]),
      );
      if (contactIds.length) {
        const { data: cs } = await supabase
          .from("contacts")
          .select("id,first_name,last_name")
          .in("id", contactIds);
        setSourceContacts((cs as ContactLite[]) || []);
      } else {
        setSourceContacts([]);
      }
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

  const stageMap = useMemo(() => {
    const m = new Map<string, Stage>();
    stages.forEach((s) => m.set(s.id, s));
    return m;
  }, [stages]);

  const filteredSortedDeals = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? deals.filter((d) => d.title.toLowerCase().includes(q)) : [...deals];
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let av: any; let bv: any;
      switch (sortBy) {
        case "value": av = Number(a.value || 0); bv = Number(b.value || 0); break;
        case "title": av = a.title.toLowerCase(); bv = b.title.toLowerCase(); break;
        case "close": av = a.expected_close_date || ""; bv = b.expected_close_date || ""; break;
        case "stage": av = stageMap.get(a.stage_id)?.sort_order ?? 0; bv = stageMap.get(b.stage_id)?.sort_order ?? 0; break;
        default: av = a.id; bv = b.id;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return list;
  }, [deals, search, sortBy, sortDir, stageMap]);

  const toggleSort = (key: typeof sortBy) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(key); setSortDir(key === "value" || key === "close" ? "desc" : "asc"); }
  };

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

  const updateDeal = async (dealId: string, patch: Partial<Deal>) => {
    const prev = deals;
    setDeals((rows) => rows.map((d) => (d.id === dealId ? { ...d, ...patch } : d)));
    const { error } = await supabase.from("deals").update(patch as any).eq("id", dealId);
    if (error) {
      setDeals(prev);
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
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
          <div className="inline-flex rounded-lg border border-border/50 bg-muted/30 p-0.5">
            <button
              onClick={() => setView("board")}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                view === "board" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              title="Board view"
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Board
            </button>
            <button
              onClick={() => setView("table")}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                view === "table" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              title="Table view"
            >
              <TableIcon className="h-3.5 w-3.5" /> Table
            </button>
          </div>
        </div>
      </div>

      {view === "table" && (
        <DealsTableView
          deals={filteredSortedDeals}
          stages={stages}
          stageMap={stageMap}
          onOpen={(id) => setOpenDealId(id)}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={toggleSort}
          onUpdate={updateDeal}
        />
      )}

      {view === "board" && (

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
                {items.map((d) => {
                  const owner = people.find((p) => p.user_id === d.owner_id);
                  const sourceContact = sourceContacts.find((c) => c.id === d.source_contact_id);
                  const sourceName = sourceContact
                    ? `${sourceContact.first_name ?? ""} ${sourceContact.last_name ?? ""}`.trim()
                    : null;
                  const enteredAt = d.stage_entered_at ? new Date(d.stage_entered_at) : null;
                  const days = enteredAt
                    ? Math.floor((Date.now() - enteredAt.getTime()) / 86400000)
                    : 0;
                  const headline = d.property_address?.trim() || d.title;

                  // Compact metadata: $price · property_type · via Source
                  const descParts = [
                    formatMoney(Number(d.asking_price || d.value || 0), d.currency),
                    d.property_type,
                    sourceName ? `via ${sourceName}` : null,
                  ].filter(Boolean);

                  return (
                    <div
                      key={d.id}
                      draggable
                      onDragStart={() => setDraggingId(d.id)}
                      onDragEnd={() => { setDraggingId(null); setHoverStageId(null); }}
                      className={cn(
                        "transition-opacity cursor-grab active:cursor-grabbing",
                        draggingId === d.id && "opacity-40",
                      )}
                    >
                      <EntityCard
                        kind="deal"
                        // Only flag won/lost — open is implied by the column position.
                        status={d.status !== "open" ? d.status : null}
                        coverUrl={d.cover_url}
                        title={headline}
                        description={descParts.join(" · ")}
                        assignees={owner ? [{
                          user_id: owner.user_id,
                          full_name: owner.full_name,
                          avatar_url: owner.avatar_url,
                        }] : []}
                        dateLabel={`${days}d in stage`}
                        dateIcon={Clock}
                        onClick={() => setOpenDealId(d.id)}
                      />
                    </div>
                  );
                })}
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
      )}

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

interface DealsTableViewProps {
  deals: Deal[];
  stages: Stage[];
  stageMap: Map<string, Stage>;
  onOpen: (id: string) => void;
  sortBy: "created" | "value" | "title" | "close" | "stage";
  sortDir: "asc" | "desc";
  onSort: (key: "created" | "value" | "title" | "close" | "stage") => void;
  onUpdate: (dealId: string, patch: Partial<Deal>) => Promise<void>;
}

const STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: "open", label: "Open", color: "210 70% 50%" },
  { value: "won", label: "Won", color: "142 76% 36%" },
  { value: "lost", label: "Lost", color: "0 70% 50%" },
];

function DealsTableView({ deals, stages, stageMap, onOpen, sortBy, sortDir, onSort, onUpdate }: DealsTableViewProps) {
  if (deals.length === 0) {
    return (
      <DataTableEmpty
        icon={<Briefcase className="h-7 w-7" />}
        title="No deals to show"
        hint="Try changing the search or pipeline."
      />
    );
  }

  const template = "2.4fr 1.4fr 1.1fr 1.1fr 1.1fr 1.2fr";

  const SortHeader = ({ k, label, className }: { k: typeof sortBy; label: string; className?: string }) => (
    <button
      onClick={() => onSort(k)}
      className={cn(
        "inline-flex items-center gap-1 text-left uppercase tracking-[0.14em]",
        sortBy === k && "text-foreground",
        className,
      )}
    >
      {label}
      <ArrowUpDown className={cn("h-3 w-3 opacity-40", sortBy === k && "opacity-100")} />
      {sortBy === k && <span className="text-[9px]">{sortDir === "asc" ? "↑" : "↓"}</span>}
    </button>
  );

  const stageOptions = stages.map((s) => ({
    value: s.id,
    label: s.name,
    color: s.color || "220 12% 60%",
  }));

  return (
    <DataTableShell>
      <DataTableHeader template={template}>
        <div><SortHeader k="title" label="Deal" /></div>
        <div><SortHeader k="stage" label="Stage" /></div>
        <div><SortHeader k="value" label="Value" /></div>
        <div>Status</div>
        <div><SortHeader k="close" label="Close date" /></div>
        <div><SortHeader k="created" label="Created" /></div>
      </DataTableHeader>
      {deals.map((d) => {
        const stage = stageMap.get(d.stage_id);
        const stageColor = stage?.color || "220 12% 60%";
        const statusColor =
          d.status === "won" ? "142 76% 36%" :
          d.status === "lost" ? "0 70% 50%" :
          "210 70% 50%";
        return (
          <DataTableRow key={d.id} template={template} onClick={() => onOpen(d.id)}>
            {/* TITLE */}
            <div className="font-medium truncate min-w-0 pr-2">
              <InlineTextCell
                value={d.title}
                onSave={(v) => onUpdate(d.id, { title: v ?? d.title })}
                display={<span className="truncate">{d.title}</span>}
              />
            </div>

            {/* STAGE */}
            <div className="min-w-0">
              <InlinePopoverCell
                ariaLabel="Change stage"
                trigger={
                  stage ? (
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: `hsl(${stageColor})` }} />
                      <span className="truncate">{stage.name}</span>
                    </span>
                  ) : (
                    <span className="italic text-muted-foreground/60 text-xs">—</span>
                  )
                }
              >
                {(close) => (
                  <InlineOptionList
                    value={d.stage_id}
                    options={stageOptions}
                    close={close}
                    onChange={(v) => {
                      const s = stages.find((x) => x.id === v);
                      const status = s?.is_won ? "won" : s?.is_lost ? "lost" : "open";
                      return onUpdate(d.id, { stage_id: v, status });
                    }}
                  />
                )}
              </InlinePopoverCell>
            </div>

            {/* VALUE */}
            <div className="tabular-nums truncate pr-3">
              <InlineTextCell
                value={d.value != null ? String(d.value) : ""}
                type="number"
                onSave={(v) => onUpdate(d.id, { value: v ? Number(v) : 0 })}
                display={<span>{formatMoney(Number(d.value || 0), d.currency)}</span>}
              />
            </div>

            {/* STATUS */}
            <div>
              <InlinePopoverCell
                ariaLabel="Change status"
                trigger={
                  <DataTablePill hsl={statusColor} className="capitalize">{d.status}</DataTablePill>
                }
              >
                {(close) => (
                  <InlineOptionList
                    value={d.status}
                    options={STATUS_OPTIONS}
                    close={close}
                    onChange={(v) => onUpdate(d.id, { status: v })}
                  />
                )}
              </InlinePopoverCell>
            </div>

            {/* CLOSE DATE */}
            <div className="text-xs text-muted-foreground">
              <InlineDateCell
                value={d.expected_close_date}
                onSave={(v) => onUpdate(d.id, { expected_close_date: v })}
                display={
                  d.expected_close_date ? (
                    <span>{new Date(d.expected_close_date).toLocaleDateString()}</span>
                  ) : (
                    <span className="italic text-muted-foreground/60">—</span>
                  )
                }
              />
            </div>

            {/* CREATED */}
            <div className="text-xs text-muted-foreground">
              {(d as any).created_at ? formatDistanceToNow(new Date((d as any).created_at), { addSuffix: true }) : "—"}
            </div>
          </DataTableRow>
        );
      })}
    </DataTableShell>
  );
}
