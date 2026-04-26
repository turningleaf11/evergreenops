import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  Circle,
  Trash2,
  Mail,
  Phone,
  ExternalLink,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ContactPicker } from "../ContactPicker";
import { contactTypeColor, contactTypeLabel } from "../contactTypes";
import {
  TX_LANE_LABEL,
  TX_LANE_COLOR,
  TX_TYPE_LABEL,
  TX_TYPE_COLOR,
  TX_STATUS_COLOR,
  fmtMoney,
  daysBetween,
  fmtCountdown,
  closingCountdownClass,
} from "./utils";

interface Transaction {
  id: string;
  workspace_id: string | null;
  deal_id: string | null;
  lane: string;
  transaction_type: string;
  status: string;
  property_address: string;
  property_city: string | null;
  property_state: string | null;
  property_type: string | null;
  units: number | null;
  contract_date: string | null;
  inspection_deadline: string | null;
  due_diligence_end: string | null;
  closing_date: string | null;
  purchase_price: number | null;
  assignment_fee: number | null;
  earnest_money_required: number | null;
  earnest_money_received: boolean;
  earnest_money_received_date: string | null;
  estimated_net: number | null;
  actual_net: number | null;
  buyer_contact_id: string | null;
  title_contact_id: string | null;
  attorney_contact_id: string | null;
  lender_contact_id: string | null;
  source_contact_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface ChecklistItem {
  id: string;
  label: string;
  is_complete: boolean;
  due_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  sort_order: number;
}

interface ContactDetail {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  contact_type: string | null;
}

const ROLE_LABELS = {
  buyer_contact_id: "Buyer",
  title_contact_id: "Title Agent",
  attorney_contact_id: "Attorney",
  lender_contact_id: "Lender",
} as const;

type RoleKey = keyof typeof ROLE_LABELS;

export function TransactionDetailSheet({
  transactionId,
  onClose,
  onChanged,
}: {
  transactionId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [people, setPeople] = useState<ContactDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [closeOpen, setCloseOpen] = useState(false);
  const [actualNetInput, setActualNetInput] = useState("");

  const reload = async () => {
    if (!transactionId) return;
    const [{ data: t }, { data: it }] = await Promise.all([
      supabase.from("crm_transactions").select("*").eq("id", transactionId).maybeSingle(),
      supabase
        .from("transaction_checklist_items")
        .select("*")
        .eq("transaction_id", transactionId)
        .order("sort_order", { ascending: true }),
    ]);
    const txRow = (t as Transaction) || null;
    setTx(txRow);
    setItems((it as ChecklistItem[]) || []);
    if (txRow) {
      const ids = [
        txRow.buyer_contact_id,
        txRow.title_contact_id,
        txRow.attorney_contact_id,
        txRow.lender_contact_id,
        txRow.source_contact_id,
      ].filter(Boolean) as string[];
      if (ids.length) {
        const { data: cs } = await supabase
          .from("contacts")
          .select("id,first_name,last_name,email,phone,contact_type")
          .in("id", ids);
        setPeople((cs as ContactDetail[]) || []);
      } else {
        setPeople([]);
      }
      setNotesDraft(txRow.notes || "");
    }
  };

  useEffect(() => {
    if (!transactionId) {
      setTx(null);
      setItems([]);
      setPeople([]);
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      await reload();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId]);

  const saveField = async (patch: Partial<Transaction>) => {
    if (!tx) return;
    const { error } = await supabase
      .from("crm_transactions")
      .update(patch as any)
      .eq("id", tx.id);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    setTx({ ...tx, ...patch });
    onChanged();
  };

  const toggleItem = async (item: ChecklistItem) => {
    if (!user) return;
    const newComplete = !item.is_complete;
    const patch = {
      is_complete: newComplete,
      completed_at: newComplete ? new Date().toISOString() : null,
      completed_by: newComplete ? user.id : null,
    };
    setItems((arr) => arr.map((i) => (i.id === item.id ? { ...i, ...patch } as ChecklistItem : i)));
    const { error } = await supabase.from("transaction_checklist_items").update(patch).eq("id", item.id);
    if (error) toast({ title: "Couldn't update", description: error.message, variant: "destructive" });
  };

  const setItemDueDate = async (id: string, due_date: string | null) => {
    setItems((arr) => arr.map((i) => (i.id === id ? { ...i, due_date } : i)));
    await supabase.from("transaction_checklist_items").update({ due_date }).eq("id", id);
  };

  const handleDelete = async () => {
    if (!tx) return;
    if (!confirm("Delete this transaction? This cannot be undone.")) return;
    const { error } = await supabase.from("crm_transactions").delete().eq("id", tx.id);
    if (error) {
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
      return;
    }
    onChanged();
    onClose();
  };

  const markClosed = async () => {
    const net = actualNetInput ? Number(actualNetInput) : null;
    await saveField({ status: "closed", actual_net: net });
    setCloseOpen(false);
    setActualNetInput("");
  };

  const isOpenSheet = !!transactionId;
  const closingDays = daysBetween(tx?.closing_date);
  const progress = items.length ? items.filter((i) => i.is_complete).length : 0;
  const total = items.length;
  const progressPct = total ? (progress / total) * 100 : 0;

  return (
    <>
      <Sheet open={isOpenSheet} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-3xl p-0 flex flex-col">
          {loading || !tx ? (
            <div className="flex items-center justify-center h-full text-muted-foreground gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              {/* SECTION 1 — HEADER */}
              <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <SheetTitle className="text-xl truncate">
                      {tx.property_address || "Untitled property"}
                    </SheetTitle>
                    <div className="flex items-center gap-2 flex-wrap pt-1.5">
                      <Badge
                        className="text-[10px] border-transparent"
                        style={{
                          backgroundColor: `hsl(${TX_LANE_COLOR[tx.lane]} / 0.15)`,
                          color: `hsl(${TX_LANE_COLOR[tx.lane]})`,
                        }}
                      >
                        {TX_LANE_LABEL[tx.lane]}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                        style={{
                          borderColor: `hsl(${TX_TYPE_COLOR[tx.transaction_type]})`,
                          color: `hsl(${TX_TYPE_COLOR[tx.transaction_type]})`,
                        }}
                      >
                        {TX_TYPE_LABEL[tx.transaction_type]}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] capitalize"
                        style={{
                          borderColor: `hsl(${TX_STATUS_COLOR[tx.status]})`,
                          color: `hsl(${TX_STATUS_COLOR[tx.status]})`,
                        }}
                      >
                        {tx.status}
                      </Badge>
                      {[tx.property_city, tx.property_state].filter(Boolean).length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {[tx.property_city, tx.property_state].filter(Boolean).join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {tx.status !== "closed" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setActualNetInput(tx.estimated_net?.toString() || "");
                          setCloseOpen(true);
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark as Closed
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDelete}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-auto p-6 space-y-6">
                {/* SECTION 2 — KEY DATES */}
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Key dates
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <DateCard
                      label="Contract Date"
                      value={tx.contract_date}
                      onChange={(v) => saveField({ contract_date: v })}
                    />
                    <DateCard
                      label="Inspection Deadline"
                      value={tx.inspection_deadline}
                      onChange={(v) => saveField({ inspection_deadline: v })}
                    />
                    <DateCard
                      label="Due Diligence End"
                      value={tx.due_diligence_end}
                      onChange={(v) => saveField({ due_diligence_end: v })}
                    />
                    <DateCard
                      label="Closing Date"
                      value={tx.closing_date}
                      onChange={(v) => saveField({ closing_date: v })}
                      emphasized
                      countdownClass={closingCountdownClass(closingDays)}
                    />
                  </div>
                </section>

                {/* SECTION 3 — KEY PEOPLE */}
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Key people
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(Object.keys(ROLE_LABELS) as RoleKey[]).map((roleKey) => {
                      const id = tx[roleKey];
                      const contact = people.find((p) => p.id === id);
                      return (
                        <PersonCard
                          key={roleKey}
                          label={ROLE_LABELS[roleKey]}
                          contact={contact || null}
                          onPick={(newId) => saveField({ [roleKey]: newId } as any)}
                        />
                      );
                    })}
                  </div>
                </section>

                {/* SECTION 4 — CHECKLIST */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Closing checklist
                    </h3>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {progress} of {total} complete
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <ul className="space-y-1 rounded-xl border border-border/50 bg-card divide-y divide-border/40">
                    {items.map((item) => (
                      <li key={item.id} className="flex items-start gap-3 px-3 py-2.5">
                        <button
                          onClick={() => toggleItem(item)}
                          className="shrink-0 mt-0.5"
                        >
                          {item.is_complete ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div
                            className={cn(
                              "text-sm",
                              item.is_complete && "line-through text-muted-foreground",
                            )}
                          >
                            {item.label}
                          </div>
                          {item.is_complete && item.completed_at && (
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              Completed {formatDistanceToNow(new Date(item.completed_at), { addSuffix: true })}
                            </div>
                          )}
                        </div>
                        <Input
                          type="date"
                          value={item.due_date ?? ""}
                          onChange={(e) => setItemDueDate(item.id, e.target.value || null)}
                          className="h-7 text-xs w-[140px] shrink-0"
                        />
                      </li>
                    ))}
                    {items.length === 0 && (
                      <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                        No checklist items.
                      </li>
                    )}
                  </ul>
                </section>

                {/* SECTION 5 — P&L */}
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    P&L summary
                  </h3>
                  <div className="rounded-xl border border-border/50 bg-card p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                    <MoneyField
                      label="Purchase price"
                      value={tx.purchase_price}
                      onSave={(v) => saveField({ purchase_price: v })}
                    />
                    <MoneyField
                      label="Assignment fee"
                      value={tx.assignment_fee}
                      onSave={(v) => saveField({ assignment_fee: v })}
                    />
                    <MoneyField
                      label="Earnest money required"
                      value={tx.earnest_money_required}
                      onSave={(v) => saveField({ earnest_money_required: v })}
                    />
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">EM received</Label>
                      <button
                        onClick={() =>
                          saveField({
                            earnest_money_received: !tx.earnest_money_received,
                            earnest_money_received_date: !tx.earnest_money_received
                              ? format(new Date(), "yyyy-MM-dd")
                              : null,
                          })
                        }
                        className={cn(
                          "px-3 py-2 rounded-md text-xs font-medium border transition-colors",
                          tx.earnest_money_received
                            ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                            : "bg-muted text-muted-foreground border-border",
                        )}
                      >
                        {tx.earnest_money_received ? "Received" : "Not received"}
                      </button>
                    </div>
                    <MoneyField
                      label="Estimated net"
                      value={tx.estimated_net}
                      onSave={(v) => saveField({ estimated_net: v })}
                    />
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Actual net</Label>
                      {tx.status === "closed" ? (
                        <Input
                          type="number"
                          defaultValue={tx.actual_net ?? ""}
                          onBlur={(e) =>
                            saveField({ actual_net: e.target.value ? Number(e.target.value) : null })
                          }
                          className="h-9 text-base font-semibold text-emerald-600 tabular-nums"
                        />
                      ) : (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          Available after close
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* SECTION 6 — NOTES */}
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Notes
                  </h3>
                  <Textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    onBlur={() => {
                      if (notesDraft !== (tx.notes ?? "")) {
                        saveField({ notes: notesDraft });
                      }
                    }}
                    rows={4}
                    placeholder="Notes about this transaction…"
                    className="resize-none"
                  />
                  <p className="text-[11px] text-muted-foreground">Saves on blur.</p>
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Mark as closed dialog */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark as closed</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Actual net</Label>
            <Input
              type="number"
              value={actualNetInput}
              onChange={(e) => setActualNetInput(e.target.value)}
              placeholder="0"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)}>Cancel</Button>
            <Button onClick={markClosed}>Confirm close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DateCard({
  label,
  value,
  onChange,
  emphasized,
  countdownClass,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  emphasized?: boolean;
  countdownClass?: string;
}) {
  const days = daysBetween(value);
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-3 space-y-1.5",
        emphasized ? "border-primary/30 bg-primary/5" : "border-border/50",
      )}
    >
      <div className={cn("text-[10px] uppercase tracking-wide text-muted-foreground", emphasized && "text-primary")}>
        {label}
      </div>
      <Input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className={cn("h-8 text-sm bg-transparent border-0 px-0", emphasized && "text-base font-semibold")}
      />
      <div
        className={cn(
          "inline-block text-[10px] px-1.5 py-0.5 rounded border",
          countdownClass ?? "text-muted-foreground bg-muted/40 border-border/40",
        )}
      >
        {fmtCountdown(days)}
      </div>
    </div>
  );
}

function PersonCard({
  label,
  contact,
  onPick,
}: {
  label: string;
  contact: ContactDetail | null;
  onPick: (id: string | null) => void;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
          {label}
        </span>
        {contact?.contact_type && (
          <Badge
            className="text-[9px] border-transparent"
            style={{
              backgroundColor: `hsl(${contactTypeColor(contact.contact_type)} / 0.15)`,
              color: `hsl(${contactTypeColor(contact.contact_type)})`,
            }}
          >
            {contactTypeLabel(contact.contact_type)}
          </Badge>
        )}
      </div>
      {contact ? (
        <div className="space-y-1">
          <a
            href={`/crm/contacts?contact=${contact.id}`}
            className="text-sm font-medium hover:text-primary inline-flex items-center gap-1"
          >
            {`${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "Unnamed"}
            <ExternalLink className="h-3 w-3" />
          </a>
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
            >
              <Mail className="h-3 w-3" /> {contact.email}
            </a>
          )}
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
            >
              <Phone className="h-3 w-3" /> {contact.phone}
            </a>
          )}
          <button
            onClick={() => onPick(null)}
            className="text-[10px] text-muted-foreground hover:text-destructive"
          >
            Remove
          </button>
        </div>
      ) : (
        <ContactPicker
          value={null}
          onChange={(id) => onPick(id)}
          placeholder={`Pick ${label.toLowerCase()}…`}
        />
      )}
    </div>
  );
}

function MoneyField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: number | null;
  onSave: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState(value?.toString() ?? "");
  useEffect(() => setDraft(value?.toString() ?? ""), [value]);
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = draft === "" ? null : Number(draft);
          if (n !== value) onSave(n);
        }}
        className="h-8 text-sm tabular-nums"
      />
    </div>
  );
}
