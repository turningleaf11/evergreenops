import { useEffect, useMemo, useState } from "react";
import { Plus, Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  DataTableShell,
  DataTableHeader,
  DataTableRow,
  DataTablePill,
} from "@/components/ui/data-table-shell";
import { InlinePopoverCell, InlineOptionList, InlineDateCell } from "../InlineCellEditors";
import { NewTransactionDialog } from "./NewTransactionDialog";
import { TransactionDetailSheet } from "./TransactionDetailSheet";
import {
  TX_LANE_COLOR,
  TX_LANE_LABEL,
  TX_TYPE_COLOR,
  TX_TYPE_LABEL,
  TX_STATUS_COLOR,
  fmtMoney,
  daysBetween,
  closingCountdownClass,
  fmtCountdown,
} from "./utils";

interface Tx {
  id: string;
  lane: string;
  transaction_type: string;
  status: string;
  property_address: string;
  property_city: string | null;
  property_state: string | null;
  closing_date: string | null;
  buyer_contact_id: string | null;
  estimated_net: number | null;
  actual_net: number | null;
}

interface ContactLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

// dispo_* tables aren't in the generated Supabase types (created directly in
// the DB); route dispo reads through this untyped handle until types are regen'd.
const dispo = supabase as unknown as { from: (table: string) => any };

export function TransactionsList({ search, newSignal = 0 }: { search: string; newSignal?: number }) {
  const { id: workspaceId } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Tx[]>([]);
  const [contacts, setContacts] = useState<ContactLite[]>([]);
  const [progress, setProgress] = useState<Record<string, { done: number; total: number }>>({});
  const [interest, setInterest] = useState<Record<string, { count: number; top: number | null }>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [newOpen, setNewOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const [laneFilter, setLaneFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [closingFilter, setClosingFilter] = useState<string>("all");

  useEffect(() => {
    if (newSignal > 0) setNewOpen(true);
  }, [newSignal]);

  useEffect(() => {
    if (!workspaceId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("crm_transactions")
        .select("id,lane,transaction_type,status,property_address,property_city,property_state,closing_date,buyer_contact_id,estimated_net,actual_net")
        .eq("workspace_id", workspaceId)
        .order("closing_date", { ascending: true, nullsFirst: false });
      const rows = (data as Tx[]) || [];
      setItems(rows);

      const buyerIds = Array.from(new Set(rows.map((r) => r.buyer_contact_id).filter(Boolean) as string[]));
      if (buyerIds.length) {
        const { data: cs } = await supabase
          .from("contacts")
          .select("id,first_name,last_name")
          .in("id", buyerIds);
        setContacts((cs as ContactLite[]) || []);
      } else {
        setContacts([]);
      }

      // Checklist progress aggregate
      const ids = rows.map((r) => r.id);
      if (ids.length) {
        const { data: items } = await supabase
          .from("transaction_checklist_items")
          .select("transaction_id, is_complete")
          .in("transaction_id", ids);
        const map: Record<string, { done: number; total: number }> = {};
        (items || []).forEach((i: any) => {
          if (!map[i.transaction_id]) map[i.transaction_id] = { done: 0, total: 0 };
          map[i.transaction_id].total += 1;
          if (i.is_complete) map[i.transaction_id].done += 1;
        });
        setProgress(map);
      } else {
        setProgress({});
      }

      // Buyer interest aggregate (dispo_deal_interests) — count + top offer per deal
      if (ids.length) {
        const { data: ints } = await dispo
          .from("dispo_deal_interests")
          .select("transaction_id, offer_amount")
          .in("transaction_id", ids);
        const im: Record<string, { count: number; top: number | null }> = {};
        (ints || []).forEach((x: any) => {
          if (!im[x.transaction_id]) im[x.transaction_id] = { count: 0, top: null };
          im[x.transaction_id].count += 1;
          if (x.offer_amount != null && (im[x.transaction_id].top == null || x.offer_amount > im[x.transaction_id].top)) {
            im[x.transaction_id].top = x.offer_amount;
          }
        });
        setInterest(im);
      } else {
        setInterest({});
      }
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
    if (!c) return "—";
    return `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—";
  };

  const updateTx = async (id: string, patch: Partial<Tx>) => {
    const prev = items;
    setItems((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("crm_transactions").update(patch as any).eq("id", id);
    if (error) {
      setItems(prev);
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-4">
      {/* Filter strip */}
      <div className="flex items-center justify-between flex-wrap gap-3 rounded-xl border border-border/50 bg-card px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={laneFilter} onValueChange={setLaneFilter}>
            <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All lanes</SelectItem>
              <SelectItem value="wholesale">Wholesale</SelectItem>
              <SelectItem value="portfolio">Portfolio</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={closingFilter} onValueChange={setClosingFilter}>
            <SelectTrigger className="h-8 text-xs w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any closing date</SelectItem>
              <SelectItem value="this_week">Closing ≤ 7 days</SelectItem>
              <SelectItem value="this_month">Closing ≤ 30 days</SelectItem>
              <SelectItem value="overdue">Past closing</SelectItem>
            </SelectContent>
          </Select>
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
          <DataTableHeader template="2.4fr 0.9fr 1fr 1.3fr 1.2fr 1.4fr 1fr">
            <div>Property</div>
            <div>Lane</div>
            <div>Type</div>
            <div>Closing date</div>
            <div>Buyer</div>
            <div>Checklist</div>
            <div className="text-right">Est. net</div>
          </DataTableHeader>
          {filtered.map((r) => {
            const days = daysBetween(r.closing_date);
            const prog = progress[r.id] || { done: 0, total: 0 };
            const pct = prog.total ? (prog.done / prog.total) * 100 : 0;
            const propLabel = r.property_address?.trim() || "Untitled";
            return (
              <DataTableRow
                key={r.id}
                template="2.4fr 0.9fr 1fr 1.3fr 1.2fr 1.4fr 1fr"
                onClick={() => setOpenId(r.id)}
                asButton
              >
                {/* PROPERTY */}
                <div className="min-w-0 pr-3">
                  <div className="text-[14px] font-semibold truncate text-foreground leading-tight">
                    {propLabel}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate leading-tight">
                    {[r.property_city, r.property_state].filter(Boolean).join(", ") || (
                      <span className="italic text-muted-foreground/60">no city</span>
                    )}
                    {r.status !== "active" && (
                      <DataTablePill hsl={TX_STATUS_COLOR[r.status]} className="ml-2 text-[10px] px-2 py-[2px]">
                        {r.status}
                      </DataTablePill>
                    )}
                  </div>
                </div>

                {/* LANE */}
                <div>
                  <InlinePopoverCell
                    ariaLabel="Change lane"
                    trigger={
                      <DataTablePill hsl={TX_LANE_COLOR[r.lane]}>
                        {TX_LANE_LABEL[r.lane]}
                      </DataTablePill>
                    }
                  >
                    {(close) => (
                      <InlineOptionList
                        value={r.lane}
                        options={Object.keys(TX_LANE_LABEL).map((k) => ({
                          value: k,
                          label: TX_LANE_LABEL[k],
                          color: TX_LANE_COLOR[k],
                        }))}
                        close={close}
                        onChange={(v) => updateTx(r.id, { lane: v })}
                      />
                    )}
                  </InlinePopoverCell>
                </div>

                {/* TYPE */}
                <div>
                  <InlinePopoverCell
                    ariaLabel="Change type"
                    trigger={
                      <DataTablePill hsl={TX_TYPE_COLOR[r.transaction_type]} bgOpacity={0.13}>
                        {TX_TYPE_LABEL[r.transaction_type]}
                      </DataTablePill>
                    }
                  >
                    {(close) => (
                      <InlineOptionList
                        value={r.transaction_type}
                        options={Object.keys(TX_TYPE_LABEL).map((k) => ({
                          value: k,
                          label: TX_TYPE_LABEL[k],
                          color: TX_TYPE_COLOR[k],
                        }))}
                        close={close}
                        onChange={(v) => updateTx(r.id, { transaction_type: v })}
                      />
                    )}
                  </InlinePopoverCell>
                </div>

                {/* CLOSING */}
                <div className="text-xs pr-2">
                  <InlineDateCell
                    value={r.closing_date}
                    onSave={(v) => updateTx(r.id, { closing_date: v })}
                    display={
                      r.closing_date ? (
                        <>
                          <div className="text-foreground text-[13px]">
                            {new Date(r.closing_date).toLocaleDateString()}
                          </div>
                          <span
                            className={cn(
                              "inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded border font-medium",
                              closingCountdownClass(days),
                            )}
                          >
                            {fmtCountdown(days)}
                          </span>
                        </>
                      ) : (
                        <span className="italic text-brand-coral/80 text-[12px]">No date set</span>
                      )
                    }
                  />
                </div>

                {/* BUYER + INTEREST */}
                <div className="pr-2 min-w-0">
                  <div className="text-[13px] truncate leading-tight">
                    {r.buyer_contact_id ? (
                      buyerName(r.buyer_contact_id)
                    ) : (
                      <span className="italic text-muted-foreground/60">—</span>
                    )}
                  </div>
                  {interest[r.id]?.count > 0 && (
                    <div className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                      {interest[r.id].count} interested
                      {interest[r.id].top != null && (
                        <span className="text-brand-mint-deep"> · top {fmtMoney(interest[r.id].top)}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* CHECKLIST */}
                <div className="text-xs pr-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden min-w-[40px]">
                      <div
                        className="h-full bg-brand-mint"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 font-medium">
                      {prog.done} of {prog.total}
                    </span>
                  </div>
                </div>

                {/* EST NET */}
                <div className="text-right text-[13px] tabular-nums font-medium">
                  {(r.status === "closed" ? r.actual_net : r.estimated_net) == null ? (
                    <span className="italic text-muted-foreground/60 font-normal">—</span>
                  ) : (
                    fmtMoney(r.status === "closed" ? r.actual_net : r.estimated_net)
                  )}
                </div>
              </DataTableRow>
            );
          })}
        </DataTableShell>
      )}

      <NewTransactionDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={(id) => {
          setRefreshKey((k) => k + 1);
          setOpenId(id);
        }}
      />

      <TransactionDetailSheet
        transactionId={openId}
        onClose={() => setOpenId(null)}
        onChanged={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
