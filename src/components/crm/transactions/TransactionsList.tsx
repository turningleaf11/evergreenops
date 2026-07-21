// The Deals home. One list of active deals, viewed through a lens that matches
// the person's job — Dispo (director) or Closings (TC) — plus an All view.
// Same rows, different columns. The lens defaults from the user's title.

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  DataTableShell, DataTableHeader, DataTableRow, DataTablePill,
} from "@/components/ui/data-table-shell";
import { InlinePopoverCell, InlineOptionList, InlineDateCell } from "../InlineCellEditors";
import { NewTransactionDialog } from "./NewTransactionDialog";
import { TransactionDetailSheet } from "./TransactionDetailSheet";
import { resolveStatusTone } from "@/lib/statusTone";
import { DEAL_STAGES, STAGE_BY_VALUE, statusForStage } from "@/lib/dealVocab";
import {
  TX_LANE_COLOR, TX_LANE_LABEL, TX_STATUS_COLOR,
  fmtMoney, daysBetween, closingCountdownClass, fmtCountdown,
} from "./utils";

type Lens = "dispo" | "closings" | "all";

interface Tx {
  id: string;
  lane: string;
  transaction_type: string;
  status: string;
  stage: string;
  next_action: string | null;
  property_address: string;
  property_city: string | null;
  property_state: string | null;
  closing_date: string | null;
  purchase_price: number | null;
  asking_price: number | null;
  buyer_contact_id: string | null;
  estimated_net: number | null;
  actual_net: number | null;
}

interface ContactLite { id: string; first_name: string | null; last_name: string | null; }

// dispo_* tables aren't in the generated Supabase types; untyped handle.
const dispo = supabase as unknown as { from: (table: string) => any };

const stageHsl = (stage: string) => resolveStatusTone("deal_stage", stage || "prep").hsl;
const STAGE_OPTIONS = DEAL_STAGES.map((s) => ({ value: s.value, label: s.label, color: stageHsl(s.value) }));

const LENS_TEMPLATE: Record<Lens, string> = {
  dispo: "2.1fr 1.5fr 1.7fr 1.1fr",
  closings: "2.1fr 1.5fr 1.3fr 1.3fr 1fr",
  all: "2fr 1.4fr 0.8fr 1.2fr 1.2fr 1fr",
};

export function TransactionsList({ search, newSignal = 0 }: { search: string; newSignal?: number }) {
  const { id: workspaceId } = useWorkspace();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Tx[]>([]);
  const [contacts, setContacts] = useState<ContactLite[]>([]);
  const [progress, setProgress] = useState<Record<string, { done: number; total: number }>>({});
  const [interest, setInterest] = useState<Record<string, { count: number; top: number | null }>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [newOpen, setNewOpen] = useState(false);
  // The open deal is kept in the URL (?deal=) so a page refresh reopens it
  // instead of dropping back to the table.
  const [searchParams, setSearchParams] = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(() => searchParams.get("deal"));

  useEffect(() => {
    const cur = searchParams.get("deal");
    if (openId === cur) return;
    const next = new URLSearchParams(searchParams);
    if (openId) next.set("deal", openId);
    else next.delete("deal");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const [lens, setLens] = useState<Lens>("all");
  const [lensInit, setLensInit] = useState(false);
  const [laneFilter, setLaneFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [closingFilter, setClosingFilter] = useState<string>("all");

  useEffect(() => { if (newSignal > 0) setNewOpen(true); }, [newSignal]);

  // Default the lens from the user's title (Dispositions Director -> dispo,
  // Transaction Coordinator -> closings). Only sets the initial value.
  useEffect(() => {
    if (!user || lensInit) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("title").eq("user_id", user.id).maybeSingle();
      const t = ((data as any)?.title ?? "").toLowerCase();
      if (t.includes("disposition")) setLens("dispo");
      else if (t.includes("transaction") || t.includes("coordinator")) setLens("closings");
      setLensInit(true);
    })();
  }, [user, lensInit]);

  useEffect(() => {
    if (!workspaceId) return;
    (async () => {
      setLoading(true);
      // Routed through the untyped handle — stage/next_action aren't in the
      // generated types yet (added directly to the DB).
      const { data } = await dispo
        .from("crm_transactions")
        .select("id,lane,transaction_type,status,stage,next_action,property_address,property_city,property_state,closing_date,purchase_price,asking_price,buyer_contact_id,estimated_net,actual_net")
        .eq("workspace_id", workspaceId)
        .order("closing_date", { ascending: true, nullsFirst: false });
      const rows = (data as Tx[]) || [];
      setItems(rows);

      const buyerIds = Array.from(new Set(rows.map((r) => r.buyer_contact_id).filter(Boolean) as string[]));
      if (buyerIds.length) {
        const { data: cs } = await supabase.from("contacts").select("id,first_name,last_name").in("id", buyerIds);
        setContacts((cs as ContactLite[]) || []);
      } else setContacts([]);

      const ids = rows.map((r) => r.id);
      if (ids.length) {
        const { data: cl } = await supabase
          .from("transaction_checklist_items").select("transaction_id, is_complete").in("transaction_id", ids);
        const map: Record<string, { done: number; total: number }> = {};
        (cl || []).forEach((i: any) => {
          if (!map[i.transaction_id]) map[i.transaction_id] = { done: 0, total: 0 };
          map[i.transaction_id].total += 1;
          if (i.is_complete) map[i.transaction_id].done += 1;
        });
        setProgress(map);

        const { data: ints } = await dispo
          .from("dispo_deal_interests").select("transaction_id, offer_amount").in("transaction_id", ids);
        const im: Record<string, { count: number; top: number | null }> = {};
        (ints || []).forEach((x: any) => {
          if (!im[x.transaction_id]) im[x.transaction_id] = { count: 0, top: null };
          im[x.transaction_id].count += 1;
          if (x.offer_amount != null && (im[x.transaction_id].top == null || x.offer_amount > im[x.transaction_id].top))
            im[x.transaction_id].top = x.offer_amount;
        });
        setInterest(im);
      } else { setProgress({}); setInterest({}); }
      setLoading(false);
    })();
  }, [workspaceId, refreshKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (laneFilter !== "all" && r.lane !== laneFilter) return false;
      if (closingFilter !== "all") {
        const d = daysBetween(r.closing_date);
        if (closingFilter === "this_week" && (d == null || d < 0 || d > 7)) return false;
        if (closingFilter === "this_month" && (d == null || d < 0 || d > 30)) return false;
        if (closingFilter === "overdue" && (d == null || d >= 0)) return false;
      }
      if (q && !r.property_address.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, statusFilter, laneFilter, closingFilter, search]);

  const buyerName = (id: string | null) => {
    if (!id) return "—";
    const c = contacts.find((x) => x.id === id);
    return c ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—" : "—";
  };

  const updateTx = async (id: string, patch: Partial<Tx>) => {
    const prev = items;
    setItems((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("crm_transactions").update(patch as any).eq("id", id);
    if (error) { setItems(prev); toast({ title: "Couldn't save", description: error.message, variant: "destructive" }); }
  };

  const template = LENS_TEMPLATE[lens];

  const StageCell = (r: Tx) => (
    <div className="flex items-center gap-1.5 min-w-0">
      <InlinePopoverCell
        ariaLabel="Change stage"
        trigger={<DataTablePill hsl={stageHsl(r.stage)}>{STAGE_BY_VALUE[r.stage || "prep"]?.label ?? r.stage}</DataTablePill>}
      >
        {(close) => (
          <InlineOptionList
            value={r.stage || "prep"}
            options={STAGE_OPTIONS}
            close={close}
            onChange={(v) => updateTx(r.id, { stage: v, status: statusForStage(v) } as Partial<Tx>)}
          />
        )}
      </InlinePopoverCell>
      {r.stage === "pending_emd" && (
        <span className="text-[9px] font-bold text-brand-coral whitespace-nowrap" title="EMD due within 24 hours">⏱ 24h</span>
      )}
    </div>
  );

  const PropertyCell = (r: Tx) => (
    <div className="min-w-0 pr-3">
      <div className="text-[14px] font-semibold truncate text-foreground leading-tight">
        {r.property_address?.trim() || "Untitled"}
      </div>
      <div className="text-[11px] text-muted-foreground truncate leading-tight">
        {[r.property_city, r.property_state].filter(Boolean).join(", ") || (
          <span className="italic text-muted-foreground/60">no city</span>
        )}
        {(r.status === "cancelled") && (
          <DataTablePill hsl={TX_STATUS_COLOR[r.status]} className="ml-2 text-[10px] px-2 py-[2px]">{r.status}</DataTablePill>
        )}
      </div>
    </div>
  );

  const ClosingCell = (r: Tx) => {
    const days = daysBetween(r.closing_date);
    return (
      <div className="text-xs pr-2">
        <InlineDateCell
          value={r.closing_date}
          onSave={(v) => updateTx(r.id, { closing_date: v })}
          display={r.closing_date ? (
            <>
              <div className="text-foreground text-[13px]">{new Date(r.closing_date).toLocaleDateString()}</div>
              <span className={cn("inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded border font-medium", closingCountdownClass(days))}>
                {fmtCountdown(days)}
              </span>
            </>
          ) : <span className="italic text-brand-coral/80 text-[12px]">No date set</span>}
        />
      </div>
    );
  };

  const ChecklistCell = (r: Tx) => {
    const prog = progress[r.id] || { done: 0, total: 0 };
    const pct = prog.total ? (prog.done / prog.total) * 100 : 0;
    return (
      <div className="text-xs pr-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden min-w-[40px]">
            <div className="h-full bg-brand-mint" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 font-medium">{prog.done} of {prog.total}</span>
        </div>
      </div>
    );
  };

  const NetCell = (r: Tx) => (
    <div className="text-right text-[13px] tabular-nums font-medium">
      {(r.status === "closed" ? r.actual_net : r.estimated_net) == null
        ? <span className="italic text-muted-foreground/60 font-normal">—</span>
        : fmtMoney(r.status === "closed" ? r.actual_net : r.estimated_net)}
    </div>
  );

  const LaneCell = (r: Tx) => (
    <div><DataTablePill hsl={TX_LANE_COLOR[r.lane]}>{TX_LANE_LABEL[r.lane]}</DataTablePill></div>
  );

  const NextActionCell = (r: Tx) => {
    const hasPrice = r.purchase_price != null || r.asking_price != null;
    const action = r.next_action || STAGE_BY_VALUE[r.stage || "prep"]?.nextAction || "—";
    return (
      <div className="min-w-0 pr-3">
        <div className="text-[13px] truncate leading-tight">{action}</div>
        {!hasPrice && (r.stage === "prep" || r.stage === "ready") && (
          <div className="text-[10px] text-brand-coral/90 leading-tight mt-0.5">needs price</div>
        )}
      </div>
    );
  };

  const BuyersCell = (r: Tx) => (
    <div className="pr-2 min-w-0">
      {interest[r.id]?.count > 0 ? (
        <>
          <div className="text-[13px] leading-tight">{interest[r.id].count} interested</div>
          {interest[r.id].top != null && (
            <div className="text-[11px] text-brand-mint-deep leading-tight">top {fmtMoney(interest[r.id].top)}</div>
          )}
        </>
      ) : r.buyer_contact_id ? (
        <div className="text-[13px] truncate">{buyerName(r.buyer_contact_id)}</div>
      ) : (
        <span className="italic text-muted-foreground/60 text-[13px]">—</span>
      )}
    </div>
  );

  const headers =
    lens === "dispo" ? ["Property", "Stage", "Next action", "Buyers"]
    : lens === "closings" ? ["Property", "Stage", "Closing date", "Checklist", "Est. net"]
    : ["Property", "Stage", "Lane", "Closing date", "Checklist", "Est. net"];

  const renderCells = (r: Tx) => {
    if (lens === "dispo") return <>{PropertyCell(r)}{StageCell(r)}{NextActionCell(r)}{BuyersCell(r)}</>;
    if (lens === "closings") return <>{PropertyCell(r)}{StageCell(r)}{ClosingCell(r)}{ChecklistCell(r)}{NetCell(r)}</>;
    return <>{PropertyCell(r)}{StageCell(r)}{LaneCell(r)}{ClosingCell(r)}{ChecklistCell(r)}{NetCell(r)}</>;
  };

  return (
    <div className="p-6 space-y-4">
      {/* Lens switcher + filters */}
      <div className="flex items-center justify-between flex-wrap gap-3 rounded-xl border border-border/50 bg-card px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border border-border/60 p-0.5 bg-muted/30">
            {(["dispo", "closings", "all"] as Lens[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLens(l)}
                className={cn(
                  "px-3 h-7 rounded-md text-xs font-medium capitalize transition-colors",
                  lens === l ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {l === "closings" ? "Closings" : l}
              </button>
            ))}
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="cancelled">Dead</SelectItem>
              <SelectItem value="all">All status</SelectItem>
            </SelectContent>
          </Select>
          <Select value={laneFilter} onValueChange={setLaneFilter}>
            <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All lanes</SelectItem>
              <SelectItem value="wholesale">Wholesale</SelectItem>
              <SelectItem value="portfolio">Portfolio</SelectItem>
            </SelectContent>
          </Select>
          {lens !== "dispo" && (
            <Select value={closingFilter} onValueChange={setClosingFilter}>
              <SelectTrigger className="h-8 text-xs w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any closing date</SelectItem>
                <SelectItem value="this_week">Closing ≤ 7 days</SelectItem>
                <SelectItem value="this_month">Closing ≤ 30 days</SelectItem>
                <SelectItem value="overdue">Past closing</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading deals…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-card py-16 text-center text-sm text-muted-foreground">
          <FileText className="h-7 w-7 mx-auto mb-2 opacity-50" />
          <p className="font-medium text-foreground mb-1">No deals</p>
          <p>Create a deal, or move one from Pipeline to Under Contract.</p>
        </div>
      ) : (
        <DataTableShell>
          <DataTableHeader template={template}>
            {headers.map((h, i) => (
              <div key={h} className={i === headers.length - 1 && lens !== "dispo" ? "text-right" : ""}>{h}</div>
            ))}
          </DataTableHeader>
          {filtered.map((r) => (
            <DataTableRow key={r.id} template={template} onClick={() => setOpenId(r.id)} asButton>
              {renderCells(r)}
            </DataTableRow>
          ))}
        </DataTableShell>
      )}

      <NewTransactionDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={(id) => { setRefreshKey((k) => k + 1); setOpenId(id); }}
      />
      <TransactionDetailSheet
        transactionId={openId}
        onClose={() => setOpenId(null)}
        onChanged={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
