import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Check,
  CheckCircle2,
  Trash2,
  Mail,
  Phone,
  ExternalLink,
  User,
  FileText,
  Scale,
  Banknote,
  Calendar as CalendarIcon,
  Home,
  Plus,
  X,
  Star,
  StarOff,
  Search,
  UserPlus,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  EntitySheetShell,
  EntitySheetHeader,
  EntityIdentityBlock,
  EntitySidebarSection,
  PrimaryContactCard,
} from "../_shell";
import { EntityComposer } from "../EntityComposer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ActivityPanel from "@/components/activity/ActivityPanel";
import { ContactActivityTab } from "@/components/crm/ContactActivityTab";
import { BuyerInterestTab } from "./BuyerInterestTab";
import { CampaignsTab } from "./CampaignsTab";
import { PrepTab } from "./PrepTab";
import { MarketingChecklist } from "./MarketingChecklist";
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
import { OwnerPicker, TransactionTeamMembersPanel } from "../PeoplePickers";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "@/components/primitives";
import { US_STATES, EXIT_STRATEGIES, PROPERTY_TYPES, STAGE_BY_VALUE, statusForStage } from "@/lib/dealVocab";
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
  stage: string;
  next_action: string | null;
  property_address: string;
  property_city: string | null;
  property_state: string | null;
  property_county_metro: string | null;
  property_type: string | null;
  best_exit: string | null;
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
  owner_id: string | null;
  primary_contact_id: string | null;
  disposition_strategy: string | null;
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
  last_contacted_at?: string | null;
  created_at?: string | null;
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
  const [contactLinks, setContactLinks] = useState<{ id: string; target_id: string }[]>([]);
  const [linkedContacts, setLinkedContacts] = useState<ContactDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [actualNetInput, setActualNetInput] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ContactDetail[]>([]);

  const reload = async () => {
    if (!transactionId) return;
    const [{ data: t }, { data: it }, { data: ls }] = await Promise.all([
      supabase.from("crm_transactions").select("*").eq("id", transactionId).maybeSingle(),
      supabase
        .from("transaction_checklist_items")
        .select("*")
        .eq("transaction_id", transactionId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("entity_links")
        .select("id,target_id")
        .eq("source_type", "transaction")
        .eq("source_id", transactionId)
        .eq("target_type", "contact"),
    ]);
    const txRow = (t as unknown as Transaction) || null;
    setTx(txRow);
    setItems((it as ChecklistItem[]) || []);
    setContactLinks((ls as { id: string; target_id: string }[]) || []);
    if (txRow) {
      // Role contacts (buyer/title/attorney/lender/source)
      const roleIds = [
        txRow.buyer_contact_id,
        txRow.title_contact_id,
        txRow.attorney_contact_id,
        txRow.lender_contact_id,
        txRow.source_contact_id,
      ].filter(Boolean) as string[];
      if (roleIds.length) {
        const { data: cs } = await supabase
          .from("contacts")
          .select("id,first_name,last_name,email,phone,contact_type,last_contacted_at,created_at")
          .in("id", roleIds);
        setPeople((cs as ContactDetail[]) || []);
      } else {
        setPeople([]);
      }

      // Linked contacts (primary + associated)
      const linkIds = ((ls as { id: string; target_id: string }[]) || []).map((l) => l.target_id);
      if (txRow.primary_contact_id) linkIds.unshift(txRow.primary_contact_id);
      const uniqLinkIds = Array.from(new Set(linkIds));
      if (uniqLinkIds.length) {
        const { data: cs } = await supabase
          .from("contacts")
          .select("id,first_name,last_name,email,phone,contact_type,last_contacted_at,created_at")
          .in("id", uniqLinkIds);
        setLinkedContacts((cs as ContactDetail[]) || []);
      } else {
        setLinkedContacts([]);
      }
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

  // Advancing the stage also syncs the coarse status so existing status-driven
  // UI (P&L "actual net", closed styling) keeps working.
  const saveStage = (stage: string) => saveField({ stage, status: statusForStage(stage) });

  // Contact search
  useEffect(() => {
    if (search.trim().length < 2) { setSearchResults([]); return; }
    let cancelled = false;
    const q = `%${search.trim()}%`;
    (async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id,first_name,last_name,email,phone,contact_type,last_contacted_at,created_at")
        .or(`first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q}`)
        .limit(8);
      if (!cancelled) setSearchResults((data as ContactDetail[]) || []);
    })();
    return () => { cancelled = true; };
  }, [search]);

  // Contact link/unlink/primary
  const linkContact = async (contactId: string) => {
    if (!tx || !user) return;
    if (!tx.primary_contact_id) {
      await saveField({ primary_contact_id: contactId });
    } else if (contactId !== tx.primary_contact_id) {
      const exists = contactLinks.some((l) => l.target_id === contactId);
      if (!exists) {
        await supabase.from("entity_links").insert({
          source_type: "transaction",
          source_id: tx.id,
          target_type: "contact",
          target_id: contactId,
          created_by: user.id,
        });
      }
    }
    await reload();
  };

  const unlinkContact = async (contactId: string) => {
    if (!tx) return;
    if (tx.primary_contact_id === contactId) {
      const others = contactLinks.map((l) => l.target_id).filter((id) => id !== contactId);
      const newPrimary = others[0] ?? null;
      if (newPrimary) {
        await supabase
          .from("entity_links")
          .delete()
          .eq("source_type", "transaction")
          .eq("source_id", tx.id)
          .eq("target_type", "contact")
          .eq("target_id", newPrimary);
      }
      await saveField({ primary_contact_id: newPrimary });
    } else {
      const link = contactLinks.find((l) => l.target_id === contactId);
      if (link) await supabase.from("entity_links").delete().eq("id", link.id);
    }
    await reload();
  };

  const makePrimary = async (contactId: string) => {
    if (!tx || tx.primary_contact_id === contactId || !user) return;
    const oldPrimary = tx.primary_contact_id;
    if (oldPrimary) {
      await supabase.from("entity_links").insert({
        source_type: "transaction",
        source_id: tx.id,
        target_type: "contact",
        target_id: oldPrimary,
        created_by: user.id,
      });
    }
    const link = contactLinks.find((l) => l.target_id === contactId);
    if (link) await supabase.from("entity_links").delete().eq("id", link.id);
    await saveField({ primary_contact_id: contactId });
    await reload();
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
    if (!confirm("Delete this deal? This cannot be undone.")) return;
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

  const primaryContact = useMemo(
    () => linkedContacts.find((c) => c.id === tx?.primary_contact_id) || null,
    [linkedContacts, tx?.primary_contact_id],
  );
  const associatedContacts = useMemo(
    () => linkedContacts.filter((c) => c.id !== tx?.primary_contact_id),
    [linkedContacts, tx?.primary_contact_id],
  );
  const linkedIds = useMemo(() => new Set(linkedContacts.map((c) => c.id)), [linkedContacts]);
  const contactName = (c: ContactDetail) =>
    `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "Untitled";

  const canManage =
    !!user && !!tx && (tx.owner_id === user.id || tx.created_by === user.id);

  return (
    <>
      <EntitySheetShell
        open={isOpenSheet}
        onOpenChange={(v) => !v && onClose()}
        loading={loading || !tx}
        width="wide"
      >
        {tx && (
          <>
            <EntitySheetHeader
              title={tx.property_address || "Untitled property"}
              subtitle={
                [tx.property_city, tx.property_state].filter(Boolean).length > 0
                  ? [tx.property_city, tx.property_state].filter(Boolean).join(", ")
                  : undefined
              }
              titleClassName="text-xl"
              leading={<Home className="h-5 w-5 text-primary" />}
              onClose={onClose}
              actions={
                <>
                  {tx.status !== "closed" && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setActualNetInput(tx.estimated_net?.toString() || "");
                        setCloseOpen(true);
                      }}
                      className="bg-brand-azure hover:bg-brand-azure/90 text-white rounded-xl h-9 px-4"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Mark as Closed
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDelete}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </>
              }
            />

            <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_320px] min-h-0 overflow-hidden">
              {/* MAIN: composer + tabs */}
              <div className="overflow-auto bg-[#F8F8F8] dark:bg-muted/10">
                {/* Composer */}
                <div className="px-6 pt-4 pb-4 bg-background border-b border-border/50">
                  <EntityComposer
                    workspaceId={tx.workspace_id}
                    entityType="transaction"
                    entityId={tx.id}
                    defaultEmail={null}
                    notePlaceholder="Jot a note about this deal…"
                    onPosted={() => { void reload(); onChanged(); }}
                  />
                </div>

                <Tabs defaultValue="summary" className="w-full">
                  <div className="px-6 pt-3 border-b border-border/40 sticky top-0 bg-background z-10">
                    <TabsList className="bg-transparent p-0 h-11 gap-1 rounded-none">
                      {[
                        { v: "summary", label: "Summary" },
                        { v: "prep", label: "Prep" },
                        { v: "marketing", label: "Marketing" },
                        { v: "buyers", label: "Buyers" },
                        { v: "closing", label: "Closing" },
                        { v: "activity", label: "Activity" },
                      ].map((t) => (
                        <TabsTrigger
                          key={t.v}
                          value={t.v}
                          className="text-[14px] font-medium px-3 h-11 rounded-none bg-transparent border-b-2 border-transparent text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:text-brand-azure data-[state=active]:border-brand-azure data-[state=active]:shadow-none"
                        >
                          {t.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>

                  {/* SUMMARY — the cockpit: stage, next move, and vital signs */}
                  <TabsContent value="summary" className="p-6 mt-0 space-y-8">
                    {/* Stage & next action — the deal's lifecycle + the next move */}
                    <section className="space-y-3">
                      <h3 className="crm-eyebrow">Stage &amp; next action</h3>
                      <div className="crm-card flex flex-wrap items-center gap-x-8 gap-y-4">
                        <div className="space-y-1.5">
                          <Label className="crm-field-label">Stage</Label>
                          <div><StatusPill kind="deal_stage" value={tx.stage || "prep"} onChange={saveStage} /></div>
                        </div>
                        <div className="space-y-1 flex-1 min-w-[220px]">
                          <Label className="crm-field-label">Next action</Label>
                          <Input
                            key={`na-${tx.stage}-${tx.next_action ?? ""}`}
                            defaultValue={tx.next_action ?? STAGE_BY_VALUE[tx.stage]?.nextAction ?? ""}
                            placeholder={STAGE_BY_VALUE[tx.stage]?.nextAction || "What's the next move?"}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              const derived = STAGE_BY_VALUE[tx.stage]?.nextAction ?? "";
                              const next = v === derived ? null : v || null;
                              if (next !== (tx.next_action ?? null)) saveField({ next_action: next });
                            }}
                            className="h-9"
                          />
                        </div>
                      </div>
                    </section>

                    {/* Vitals — the numbers that matter, read-only glance (edit in phases) */}
                    <section className="space-y-3">
                      <h3 className="crm-eyebrow">Vitals</h3>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="crm-card space-y-1.5">
                          <div className="crm-field-label">Closing</div>
                          <div className="text-lg font-semibold tabular-nums">{tx.closing_date ?? "—"}</div>
                          {tx.closing_date && (
                            <div className={cn("inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border", closingCountdownClass(closingDays))}>
                              {fmtCountdown(closingDays)}
                            </div>
                          )}
                        </div>
                        <div className="crm-card space-y-1.5">
                          <div className="crm-field-label">Purchase price</div>
                          <div className="text-lg font-semibold tabular-nums">{fmtMoney(tx.purchase_price)}</div>
                        </div>
                        <div className="crm-card space-y-1.5">
                          <div className="crm-field-label">Assignment fee</div>
                          <div className="text-lg font-semibold tabular-nums">{fmtMoney(tx.assignment_fee)}</div>
                        </div>
                        <div className="crm-card space-y-1.5">
                          <div className="crm-field-label">Est. net</div>
                          <div className="text-lg font-semibold tabular-nums text-brand-mint-deep">{fmtMoney(tx.estimated_net)}</div>
                        </div>
                      </div>
                    </section>

                    {/* Closing readiness — TC checklist progress + EM status at a glance */}
                    <section className="space-y-3">
                      <h3 className="crm-eyebrow">Closing readiness</h3>
                      <div className="crm-card space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Closing checklist</span>
                          <span className="tabular-nums">{progress} of {total}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-brand-mint transition-all" style={{ width: `${progressPct}%` }} />
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-sm text-muted-foreground">Earnest money</span>
                          <span className={cn(
                            "inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border",
                            tx.earnest_money_received
                              ? "bg-brand-mint/15 text-brand-mint-deep border-brand-mint/30"
                              : "bg-muted text-muted-foreground border-border",
                          )}>
                            {tx.earnest_money_received ? "Received" : "Not received"}
                          </span>
                        </div>
                      </div>
                    </section>
                  </TabsContent>

                  {/* PREP — property/match criteria + photos, facts, numbers, highlight */}
                  <TabsContent value="prep" className="p-6 mt-0 space-y-8">
                    {/* Property & match criteria — canonical values that drive buyer matching */}
                    <section className="space-y-3 max-w-3xl">
                      <h3 className="crm-eyebrow">Property</h3>
                      <div className="crm-card grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <Label className="crm-field-label">City</Label>
                          <Input
                            defaultValue={tx.property_city ?? ""}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v !== (tx.property_city ?? "")) saveField({ property_city: v || null });
                            }}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="crm-field-label">State</Label>
                          <Select value={tx.property_state ?? ""} onValueChange={(v) => saveField({ property_state: v })}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Select state" /></SelectTrigger>
                            <SelectContent className="max-h-72">
                              {US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="crm-field-label">County / Metro</Label>
                          <Input
                            defaultValue={tx.property_county_metro ?? ""}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v !== (tx.property_county_metro ?? "")) saveField({ property_county_metro: v || null });
                            }}
                            className="h-9"
                            placeholder="e.g. Maricopa County"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="crm-field-label">Property type</Label>
                          <Select value={tx.property_type ?? ""} onValueChange={(v) => saveField({ property_type: v })}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Select type" /></SelectTrigger>
                            <SelectContent className="max-h-72">
                              {PROPERTY_TYPES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="crm-field-label">Best exit</Label>
                          <Select value={tx.best_exit ?? ""} onValueChange={(v) => saveField({ best_exit: v })}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Select exit" /></SelectTrigger>
                            <SelectContent>
                              {EXIT_STRATEGIES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        These drive buyer matching on the Buyers tab.
                      </p>
                    </section>

                    <PrepTab transactionId={tx.id} />
                  </TabsContent>

                  {/* MARKETING — outreach campaigns + the get-it-out-there checklist */}
                  <TabsContent value="marketing" className="p-6 mt-0 space-y-10">
                    <CampaignsTab transactionId={tx.id} />
                    <MarketingChecklist transactionId={tx.id} />
                  </TabsContent>

                  {/* BUYERS — buyer↔deal interest (dispo_deal_interests) */}
                  <TabsContent value="buyers" className="p-6 mt-0">
                    <BuyerInterestTab transactionId={tx.id} />
                  </TabsContent>

                  {/* CLOSING — dates, people, P&L, and the TC closing checklist */}
                  <TabsContent value="closing" className="p-6 mt-0 space-y-8">
                    {/* Key Dates */}
                    <section className="space-y-3">
                      <h3 className="crm-eyebrow">Key dates</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

                    {/* Key People */}
                    <section className="space-y-3">
                      <h3 className="crm-eyebrow">Key people</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {(Object.keys(ROLE_LABELS) as RoleKey[]).map((roleKey) => {
                          const id = tx[roleKey];
                          const contact = people.find((p) => p.id === id);
                          return (
                            <PersonCard
                              key={roleKey}
                              roleKey={roleKey}
                              label={ROLE_LABELS[roleKey]}
                              contact={contact || null}
                              onPick={(newId) => saveField({ [roleKey]: newId } as any)}
                            />
                          );
                        })}
                      </div>
                    </section>

                    {/* P&L */}
                    <section className="space-y-3">
                      <h3 className="crm-eyebrow">P&amp;L summary</h3>
                      <div className="crm-card grid grid-cols-2 md:grid-cols-3 gap-4">
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
                          <Label className="crm-field-label">EM received</Label>
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
                              "px-3 py-2 rounded-md text-sm font-medium border transition-colors",
                              tx.earnest_money_received
                                ? "bg-brand-mint/15 text-brand-mint-deep border-brand-mint/30"
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
                          <Label className="crm-field-label">Actual net</Label>
                          {tx.status === "closed" ? (
                            <Input
                              type="number"
                              defaultValue={tx.actual_net ?? ""}
                              onBlur={(e) =>
                                saveField({ actual_net: e.target.value ? Number(e.target.value) : null })
                              }
                              className="h-9 text-base font-semibold text-brand-mint-deep tabular-nums"
                            />
                          ) : (
                            <div className="px-3 py-2 text-sm crm-empty">
                              Available after close
                            </div>
                          )}
                        </div>
                      </div>
                    </section>

                    {/* Closing checklist */}
                    <section className="space-y-4 max-w-3xl">
                      <div className="flex items-center justify-between">
                        <h3 className="crm-eyebrow">Closing checklist</h3>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {progress} of {total} complete
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-brand-mint transition-all"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <ul className="space-y-1 crm-card !p-2 divide-y divide-border/40">
                        {items.map((item) => (
                          <ChecklistRow
                            key={item.id}
                            item={item}
                            onToggle={() => toggleItem(item)}
                            onSetDue={(v) => setItemDueDate(item.id, v)}
                          />
                        ))}
                        {items.length === 0 && (
                          <li className="px-3 py-6 text-center text-xs text-muted-foreground italic">
                            No checklist items.
                          </li>
                        )}
                      </ul>
                    </section>
                  </TabsContent>

                  {/* ACTIVITY */}
                  <TabsContent value="activity" className="p-6 mt-0 overflow-hidden">
                    <div className="h-full flex flex-col max-w-3xl">
                      <ContactActivityTab entityType="transaction" entityId={tx.id} />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* RIGHT RAIL — identity-first sidebar */}
              <aside className="border-l border-border/40 overflow-auto bg-background">
                <div className="p-5 space-y-5">
                  <EntityIdentityBlock
                    title={tx.property_address || "Untitled property"}
                    badges={
                      <>
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
                      </>
                    }
                    meta={
                      [tx.property_city, tx.property_state].filter(Boolean).join(", ") ? (
                        <div>{[tx.property_city, tx.property_state].filter(Boolean).join(", ")}</div>
                      ) : null
                    }
                  />

                  <PrimaryContactCard
                    contact={primaryContact as any}
                    onUnlink={(id) => unlinkContact(id)}
                    onLink={(id) => { linkContact(id); setSearch(""); }}
                    searchQuery={search}
                    onSearchQueryChange={setSearch}
                    searchResults={searchResults.filter((c) => !linkedIds.has(c.id))}
                    canEdit={canManage}
                  />

                  <EntitySidebarSection title="Owner">
                    <OwnerPicker
                      ownerId={tx.owner_id}
                      onChange={async (id) => { await saveField({ owner_id: id } as any); }}
                      label=""
                    />
                  </EntitySidebarSection>

                  <TransactionTeamMembersPanel
                    transactionId={tx.id}
                    canManage={canManage}
                    currentUserId={user?.id ?? null}
                  />

                  <EntitySidebarSection title="Associated contacts">
                    {associatedContacts.length === 0 && (
                      <p className="text-[11px] text-muted-foreground italic">No additional contacts.</p>
                    )}
                    {associatedContacts.map((c) => (
                      <div key={c.id} className="rounded-md border border-border/40 bg-card p-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm truncate">{contactName(c)}</div>
                            {c.email && (
                              <a href={`mailto:${c.email}`} className="text-[11px] text-muted-foreground hover:text-primary truncate flex items-center gap-1">
                                <Mail className="h-3 w-3" /> {c.email}
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5">
                            <button onClick={() => makePrimary(c.id)} className="text-muted-foreground hover:text-amber-500 p-1 rounded" title="Make primary">
                              <StarOff className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => unlinkContact(c.id)} className="text-muted-foreground hover:text-destructive p-1 rounded">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </EntitySidebarSection>

                  <EntitySidebarSection title="Source">
                    <ContactPicker
                      value={tx.source_contact_id}
                      onChange={(id) => saveField({ source_contact_id: id })}
                      placeholder="Who sent this?"
                    />
                  </EntitySidebarSection>

                  <EntitySidebarSection title="Disposition strategy">
                    <select
                      value={tx.disposition_strategy ?? ""}
                      onChange={(e) => saveField({ disposition_strategy: e.target.value || null } as any)}
                      className="w-full text-sm h-9 rounded-md border border-input bg-background px-2"
                    >
                      <option value="">Choose a strategy</option>
                      <option value="buy_hold">Buy &amp; Hold</option>
                      <option value="assign">Assign</option>
                      <option value="double_close">Double Close</option>
                      <option value="pass">Pass</option>
                    </select>
                  </EntitySidebarSection>

                  <EntitySidebarSection title="Closing">
                    <div className="text-sm">
                      {tx.closing_date ? (
                        <>
                          <div className="font-medium">{tx.closing_date}</div>
                          <div
                            className={cn(
                              "inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border mt-1",
                              closingCountdownClass(closingDays),
                            )}
                          >
                            {fmtCountdown(closingDays)}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground italic">Not scheduled</span>
                      )}
                    </div>
                  </EntitySidebarSection>

                  <EntitySidebarSection title="Purchase price">
                    <div className="text-sm font-semibold tabular-nums">
                      {fmtMoney(tx.purchase_price)}
                    </div>
                  </EntitySidebarSection>

                  <EntitySidebarSection title="Estimated net">
                    <div className="text-sm tabular-nums text-brand-mint-deep">
                      {fmtMoney(tx.estimated_net)}
                    </div>
                  </EntitySidebarSection>

                  <EntitySidebarSection title="Created">
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(tx.created_at), "MMM d, yyyy")}
                    </div>
                  </EntitySidebarSection>
                </div>
              </aside>
            </div>
          </>
        )}
      </EntitySheetShell>

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
        "rounded-xl bg-card p-4 space-y-1.5 border transition-shadow",
        emphasized ? "border-brand-azure/30 lg:col-span-2" : "border-border/40",
      )}
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      <div className="crm-eyebrow flex items-center gap-1.5">
        <CalendarIcon className="h-3 w-3" /> {label}
      </div>
      <Input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className={cn(
          "bg-transparent border-0 px-0 h-8 text-base font-medium",
          emphasized && "text-lg font-semibold",
        )}
      />
      {value && (
        <div
          className={cn(
            "inline-block text-xs font-medium px-2 py-0.5 rounded-full border",
            countdownClass ?? "text-muted-foreground bg-muted/40 border-border/40",
          )}
        >
          {fmtCountdown(days)}
        </div>
      )}
    </div>
  );
}

const ROLE_ICONS: Record<RoleKey, any> = {
  buyer_contact_id: User,
  title_contact_id: FileText,
  attorney_contact_id: Scale,
  lender_contact_id: Banknote,
};

function PersonCard({
  roleKey,
  label,
  contact,
  onPick,
}: {
  roleKey: RoleKey;
  label: string;
  contact: ContactDetail | null;
  onPick: (id: string | null) => void;
}) {
  const Icon = ROLE_ICONS[roleKey] || User;
  return (
    <div
      className="rounded-xl bg-card p-5 space-y-3 border border-border/40"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      <div className="flex items-center justify-between">
        <div className="crm-eyebrow flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        {contact?.contact_type && (
          <Badge
            className="text-[10px] border-transparent"
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
        <div className="space-y-1.5">
          <a
            href={`/crm/contacts?contact=${contact.id}`}
            className="text-sm font-medium hover:text-brand-azure inline-flex items-center gap-1"
          >
            {`${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "Unnamed"}
            <ExternalLink className="h-3 w-3" />
          </a>
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand-azure"
            >
              <Mail className="h-3 w-3" /> {contact.email}
            </a>
          )}
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand-azure"
            >
              <Phone className="h-3 w-3" /> {contact.phone}
            </a>
          )}
          <button
            onClick={() => onPick(null)}
            className="text-[11px] text-muted-foreground hover:text-destructive"
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

function ChecklistRow({
  item,
  onToggle,
  onSetDue,
}: {
  item: ChecklistItem;
  onToggle: () => void;
  onSetDue: (v: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className="px-3 py-3">
      <div className="flex items-start gap-3">
        <button
          onClick={onToggle}
          className={cn(
            "shrink-0 mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
            item.is_complete
              ? "bg-brand-mint border-brand-mint text-white"
              : "border-muted-foreground/40 hover:border-brand-mint",
          )}
          aria-label={item.is_complete ? "Mark incomplete" : "Mark complete"}
        >
          {item.is_complete && <Check className="h-3 w-3" strokeWidth={3} />}
        </button>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <div
            className={cn(
              "text-sm",
              item.is_complete && "line-through text-muted-foreground",
            )}
          >
            {item.label}
          </div>
          {item.is_complete && item.completed_at && (
            <div className="text-[11px] text-muted-foreground italic mt-0.5">
              Completed {formatDistanceToNow(new Date(item.completed_at), { addSuffix: true })}
            </div>
          )}
          {!item.is_complete && item.due_date && !expanded && (
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Due {item.due_date}
            </div>
          )}
        </button>
      </div>
      {expanded && (
        <div className="mt-3 pl-8 flex items-center gap-2">
          <Label className="text-[11px] text-muted-foreground">Due date</Label>
          <Input
            type="date"
            value={item.due_date ?? ""}
            onChange={(e) => onSetDue(e.target.value || null)}
            className="h-7 text-xs w-[160px]"
          />
        </div>
      )}
    </li>
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
      <Label className="crm-field-label">{label}</Label>
      <Input
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = draft === "" ? null : Number(draft);
          if (n !== value) onSave(n);
        }}
        className="h-9 text-sm tabular-nums"
      />
    </div>
  );
}
