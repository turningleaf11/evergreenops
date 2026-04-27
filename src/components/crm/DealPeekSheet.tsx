import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Mail,
  Phone,
  Briefcase,
  ExternalLink,
  Trash2,
  Send,
  Plus,
  X,
  Star,
  StarOff,
  Search,
  UserPlus,
} from "lucide-react";
import {
  EntitySheetShell,
  EntitySheetHeader,
  EntityIdentityStrip,
  StageProgressBar,
  EntityIdentityBlock,
  EntitySidebarSection,
} from "./_shell";
import { EntityComposer } from "./EntityComposer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { CustomFieldsRenderer, useCustomFields } from "./CustomFieldsRenderer";
import { ComposeModal } from "@/components/inbox/ComposeModal";
import { QuickCreateDialog } from "./QuickCreateDialog";
import { OwnerPicker, DealTeamMembersPanel } from "./PeoplePickers";
import { CrmComposerTabs, type ComposerSubmit } from "./CrmComposerTabs";
import {
  CrmActivityTimeline,
  ActivityFilterPills,
  type TimelineActivity,
} from "./CrmActivityTimeline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NewTransactionDialog } from "./transactions/NewTransactionDialog";
import { DealOverviewPanel } from "./DealOverviewPanel";
import { DealUnderwritingTab } from "./DealUnderwritingTab";
import ActivityPanel from "@/components/activity/ActivityPanel";
import { DealFilesTab } from "./DealFilesTab";
import { ContactPicker } from "./ContactPicker";

interface Deal {
  id: string;
  workspace_id: string | null;
  title: string;
  pipeline_id: string;
  stage_id: string;
  value: number;
  currency: string;
  probability: number;
  expected_close_date: string | null;
  primary_contact_id: string | null;
  owner_id: string | null;
  created_by: string | null;
  status: string;
  lost_reason: string | null;
  description: string;
  custom_fields: Record<string, unknown>;
  // Portfolio fields
  property_address: string | null;
  property_city: string | null;
  property_state: string | null;
  property_zip: string | null;
  property_type: string | null;
  units: number | null;
  sqft: number | null;
  asking_price: number | null;
  seller_stated_value: number | null;
  source_contact_id: string | null;
  lead_id: string | null;
  disposition_strategy: string | null;
  // Underwriting
  quick_arv: number | null;
  repair_estimate: number | null;
  mao: number | null;
  spread: number | null;
  gross_income: number | null;
  vacancy_rate: number | null;
  effective_gross_income: number | null;
  operating_expenses: number | null;
  noi: number | null;
  our_value: number | null;
  our_cap_rate: number | null;
  price_per_unit: number | null;
  price_per_sqft: number | null;
  loi_date: string | null;
  loi_amount: number | null;
  broker_feedback: string | null;
}
interface Stage { id: string; name: string; color: string; is_won: boolean; is_lost: boolean }
interface ContactLite {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
}
interface LinkRow { id: string; target_id: string }
interface Person { user_id: string; full_name: string | null; avatar_url?: string | null }

const formatMoney = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);

const contactName = (c: ContactLite) =>
  `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "Untitled";

// Stage color map keyed by normalized stage name
const STAGE_BADGE: Record<string, string> = {
  buy_box_check: "bg-muted text-muted-foreground border-transparent",
  quick_underwrite: "bg-brand-azure/15 text-brand-azure border-transparent",
  broker_feedback: "bg-brand-tangerine/20 text-brand-tangerine border-transparent",
  deep_underwrite: "bg-brand-azure/15 text-brand-azure border-transparent",
  loi_sent: "bg-brand-violet/15 text-brand-violet border-transparent",
  due_diligence: "bg-brand-tangerine/20 text-brand-tangerine border-transparent",
  under_contract: "bg-brand-mint/20 text-brand-mint-deep border-transparent",
  closed: "bg-brand-mint-deep/20 text-brand-mint-deep border-transparent",
  dead: "bg-brand-coral/15 text-brand-coral border-transparent",
};

function stageBadgeClass(name: string | undefined): string {
  if (!name) return "bg-muted text-muted-foreground border-transparent";
  const key = name.toLowerCase().replace(/\s+/g, "_");
  return STAGE_BADGE[key] ?? "bg-muted text-muted-foreground border-transparent";
}

export function DealPeekSheet({
  dealId,
  onClose,
  onChanged,
}: {
  dealId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [contacts, setContacts] = useState<ContactLite[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [activities, setActivities] = useState<TimelineActivity[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [editValue, setEditValue] = useState("");
  const [editClose, setEditClose] = useState("");

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeCtx, setComposeCtx] = useState<{ to: string; subject: string; threadId?: string }>({
    to: "",
    subject: "",
  });

  // Recipient picker
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const [draftSubject, setDraftSubject] = useState("");

  // Add-contact popover
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ContactLite[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTxOpen, setNewTxOpen] = useState(false);

  const reload = async () => {
    if (!dealId) return;
    const [{ data: d }, { data: ls }, { data: acts }] = await Promise.all([
      supabase.from("deals").select("*").eq("id", dealId).maybeSingle(),
      supabase
        .from("entity_links")
        .select("id,target_id")
        .eq("source_type", "deal")
        .eq("source_id", dealId)
        .eq("target_type", "contact"),
      supabase
        .from("crm_activities")
        .select("id,type,subject,body,occurred_at,actor_id,metadata")
        .eq("entity_type", "deal")
        .eq("entity_id", dealId)
        .order("occurred_at", { ascending: false })
        .limit(200),
    ]);
    const dealRow = (d as Deal) || null;
    setDeal(dealRow);
    setLinks((ls as LinkRow[]) || []);
    setActivities((acts as TimelineActivity[]) || []);
    if (dealRow) {
      const ids = ((ls as LinkRow[]) || []).map((l) => l.target_id);
      if (dealRow.primary_contact_id) ids.unshift(dealRow.primary_contact_id);
      const uniq = Array.from(new Set(ids));
      if (uniq.length) {
        const { data: cs } = await supabase
          .from("contacts")
          .select("id,first_name,last_name,email,phone")
          .in("id", uniq);
        setContacts((cs as ContactLite[]) || []);
      } else {
        setContacts([]);
      }
    }
  };

  useEffect(() => {
    if (!dealId) { setDeal(null); return; }
    let active = true;
    (async () => {
      setLoading(true);
      const { data: d } = await supabase.from("deals").select("*").eq("id", dealId).maybeSingle();
      if (!active) return;
      const dealRow = (d as Deal) || null;
      setDeal(dealRow);
      if (dealRow) {
        setEditValue(String(dealRow.value ?? ""));
        setEditClose(dealRow.expected_close_date ?? "");
        const [{ data: st }, { data: ls }, { data: acts }, { data: ps }] = await Promise.all([
          supabase
            .from("pipeline_stages")
            .select("id,name,color,is_won,is_lost")
            .eq("pipeline_id", dealRow.pipeline_id)
            .order("sort_order"),
          supabase
            .from("entity_links")
            .select("id,target_id")
            .eq("source_type", "deal")
            .eq("source_id", dealRow.id)
            .eq("target_type", "contact"),
          supabase
            .from("crm_activities")
            .select("id,type,subject,body,occurred_at,actor_id,metadata")
            .eq("entity_type", "deal")
            .eq("entity_id", dealRow.id)
            .order("occurred_at", { ascending: false })
            .limit(200),
          supabase.from("profiles").select("user_id,full_name,avatar_url").limit(500),
        ]);
        if (!active) return;
        setStages((st as Stage[]) || []);
        setLinks((ls as LinkRow[]) || []);
        setActivities((acts as TimelineActivity[]) || []);
        setPeople((ps as Person[]) || []);
        const ids = ((ls as LinkRow[]) || []).map((l) => l.target_id);
        if (dealRow.primary_contact_id) ids.unshift(dealRow.primary_contact_id);
        const uniq = Array.from(new Set(ids));
        if (uniq.length) {
          const { data: cs } = await supabase
            .from("contacts")
            .select("id,first_name,last_name,email,phone")
            .in("id", uniq);
          setContacts((cs as ContactLite[]) || []);
        } else {
          setContacts([]);
        }
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [dealId]);

  useEffect(() => {
    if (!addOpen || search.trim().length < 2) { setSearchResults([]); return; }
    let cancelled = false;
    const q = `%${search.trim()}%`;
    (async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id,first_name,last_name,email,phone")
        .or(`first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q}`)
        .limit(8);
      if (!cancelled) setSearchResults((data as ContactLite[]) || []);
    })();
    return () => { cancelled = true; };
  }, [search, addOpen]);

  const saveField = async (patch: Partial<Deal>) => {
    if (!deal) return;
    const { error } = await supabase.from("deals").update(patch as any).eq("id", deal.id);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    setDeal({ ...deal, ...patch });
    onChanged();
  };

  const handleComposerSubmit = async (payload: ComposerSubmit) => {
    if (!deal || !user) return;
    let subject = "";
    const body = payload.body;
    const type: string = payload.type;
    if (payload.type === "call") {
      subject = `Call · ${payload.outcome.replace("_", " ")} · ${payload.durationMin}m`;
    }
    const { data, error } = await supabase
      .from("crm_activities")
      .insert({
        workspace_id: deal.workspace_id,
        entity_type: "deal",
        entity_id: deal.id,
        type,
        subject,
        body,
        actor_id: user.id,
      })
      .select("id,type,subject,body,occurred_at,actor_id,metadata")
      .single();
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    setActivities((a) => [data as TimelineActivity, ...a]);
    onChanged();
  };

  const handleDelete = async () => {
    if (!deal) return;
    if (!confirm("Delete this deal?")) return;
    const { error } = await supabase.from("deals").delete().eq("id", deal.id);
    if (error) {
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
      return;
    }
    onChanged();
    onClose();
  };

  // Contact management
  const linkContact = async (contactId: string) => {
    if (!deal || !user) return;
    if (!deal.primary_contact_id) {
      await saveField({ primary_contact_id: contactId });
    } else if (contactId !== deal.primary_contact_id) {
      const exists = links.some((l) => l.target_id === contactId);
      if (!exists) {
        await supabase.from("entity_links").insert({
          source_type: "deal",
          source_id: deal.id,
          target_type: "contact",
          target_id: contactId,
          created_by: user.id,
        });
      }
    }
    await reload();
  };

  const unlinkContact = async (contactId: string) => {
    if (!deal) return;
    if (deal.primary_contact_id === contactId) {
      const others = links.map((l) => l.target_id).filter((id) => id !== contactId);
      const newPrimary = others[0] ?? null;
      if (newPrimary) {
        await supabase
          .from("entity_links")
          .delete()
          .eq("source_type", "deal")
          .eq("source_id", deal.id)
          .eq("target_type", "contact")
          .eq("target_id", newPrimary);
      }
      await saveField({ primary_contact_id: newPrimary });
    } else {
      const link = links.find((l) => l.target_id === contactId);
      if (link) await supabase.from("entity_links").delete().eq("id", link.id);
    }
    await reload();
  };

  const makePrimary = async (contactId: string) => {
    if (!deal || deal.primary_contact_id === contactId || !user) return;
    const oldPrimary = deal.primary_contact_id;
    if (oldPrimary) {
      await supabase.from("entity_links").insert({
        source_type: "deal",
        source_id: deal.id,
        target_type: "contact",
        target_id: oldPrimary,
        created_by: user.id,
      });
    }
    const link = links.find((l) => l.target_id === contactId);
    if (link) await supabase.from("entity_links").delete().eq("id", link.id);
    await saveField({ primary_contact_id: contactId });
    await reload();
  };

  // Email
  const openCompose = (opts: { to: string; subject: string; threadId?: string }) => {
    setComposeCtx(opts);
    setComposeOpen(true);
  };

  const startNewEmail = () => {
    const initial = new Set<string>();
    if (deal?.primary_contact_id) initial.add(deal.primary_contact_id);
    setPickedIds(initial);
    setDraftSubject("");
    setRecipientPickerOpen(true);
  };

  const sendNewEmail = () => {
    const recipients = contacts
      .filter((c) => pickedIds.has(c.id) && c.email)
      .map((c) => c.email!) as string[];
    if (recipients.length === 0) {
      toast({ title: "Pick at least one contact with an email", variant: "destructive" });
      return;
    }
    setRecipientPickerOpen(false);
    openCompose({ to: recipients.join(", "), subject: draftSubject });
  };

  const handleSent = async (result: { threadId?: string; id?: string }) => {
    if (!deal || !user || !result.threadId) { void reload(); return; }
    const targets: { entity_type: "deal" | "contact"; entity_id: string }[] = [
      { entity_type: "deal", entity_id: deal.id },
    ];
    contacts
      .filter((c) => pickedIds.has(c.id))
      .forEach((c) => targets.push({ entity_type: "contact", entity_id: c.id }));
    for (const t of targets) {
      const { data: existing } = await supabase
        .from("email_links")
        .select("id")
        .eq("gmail_thread_id", result.threadId)
        .eq("entity_type", t.entity_type)
        .eq("entity_id", t.entity_id)
        .maybeSingle();
      if (existing) continue;
      await supabase.from("email_links").insert({
        workspace_id: deal.workspace_id,
        gmail_thread_id: result.threadId,
        gmail_message_id: result.id ?? null,
        entity_type: t.entity_type,
        entity_id: t.entity_id,
        subject: composeCtx.subject.slice(0, 500),
        snippet: "",
        linked_by: user.id,
      });
    }
    setPickedIds(new Set());
    void reload();
  };

  const isOpen = !!dealId;
  const currentStage = stages.find((s) => s.id === deal?.stage_id);

  const primaryContact = useMemo(
    () => contacts.find((c) => c.id === deal?.primary_contact_id) || null,
    [contacts, deal?.primary_contact_id],
  );
  const associatedContacts = useMemo(
    () => contacts.filter((c) => c.id !== deal?.primary_contact_id),
    [contacts, deal?.primary_contact_id],
  );
  const linkedIds = useMemo(() => new Set(contacts.map((c) => c.id)), [contacts]);

  const canManage =
    !!user && !!deal && (deal.owner_id === user.id || deal.created_by === user.id);

  return (
    <>
      <EntitySheetShell
        open={isOpen}
        onOpenChange={(v) => !v && onClose()}
        loading={loading || !deal}
        width="wide"
      >
        {deal && (
          <>
            <EntitySheetHeader
              title={
                deal.property_address?.trim() ||
                deal.title ||
                "Untitled deal"
              }
              subtitle={
                [deal.property_city, deal.property_state]
                  .filter(Boolean)
                  .join(", ") || undefined
              }
              titleClassName="text-xl"
              leading={<Briefcase className="h-5 w-5 text-primary" />}
              onClose={onClose}
              actions={
                <>
                  {currentStage?.name === "Under Contract" && (
                    <Button
                      size="sm"
                      onClick={() => setNewTxOpen(true)}
                      className="bg-brand-azure hover:bg-brand-azure/90 text-white rounded-xl"
                    >
                      Create Transaction →
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={startNewEmail}
                    disabled={contacts.filter((c) => c.email).length === 0}
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" /> Email
                  </Button>
                  {canManage && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDelete}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </>
              }
            />
            <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_320px] min-h-0 overflow-hidden">
                {/* Main column */}
                <div className="overflow-auto bg-[#F8F8F8] dark:bg-muted/10">
                  {/* Stage progression bar pinned at top */}
                  {stages.length > 0 && (
                    <div className="px-6 pt-5 pb-3 bg-background border-b border-border/50">
                      <div className="max-w-3xl">
                        <StageProgressBar
                          stages={stages.map((s) => ({
                            id: s.id,
                            label: s.name,
                            isWon: s.is_won,
                            isLost: s.is_lost,
                          }))}
                          currentId={deal.stage_id}
                          onChange={(stageId) => {
                            const s = stages.find((x) => x.id === stageId);
                            const status = s?.is_won ? "won" : s?.is_lost ? "lost" : "open";
                            return saveField({ stage_id: stageId, status } as any);
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {/* Composer pinned above the tabs */}
                  <div className="px-6 pt-4 pb-4 bg-background border-b border-border/50">
                    <div className="max-w-3xl">
                      <EntityComposer
                        workspaceId={deal.workspace_id}
                        entityType="deal"
                        entityId={deal.id}
                        defaultEmail={primaryContact?.email ?? null}
                        notePlaceholder="Jot a note about this deal…"
                        onPosted={() => { void reload(); onChanged(); }}
                      />
                    </div>
                  </div>

                    <TabsContent value="overview" className="p-4 mt-0">
                      <DealOverviewPanel
                        deal={deal as any}
                        workspaceId={deal.workspace_id}
                        onSave={async (patch) => { await saveField(patch as any); }}
                      />
                    </TabsContent>

                    <TabsContent value="underwriting" className="p-4 mt-0">
                      <DealUnderwritingTab
                        deal={deal as any}
                        onChanged={() => { void reload(); onChanged(); }}
                      />
                    </TabsContent>

                    <TabsContent value="broker" className="p-4 mt-0 space-y-3">
                      <section className="crm-card space-y-3">
                        <h3 className="crm-eyebrow">Broker feedback</h3>
                        {deal.broker_feedback ? (
                          <p className="text-sm whitespace-pre-wrap text-foreground/90">
                            {deal.broker_feedback}
                          </p>
                        ) : (
                          <p className="text-sm italic text-muted-foreground">
                            No broker feedback captured yet. Add notes in the Underwriting tab.
                          </p>
                        )}
                      </section>
                      <section className="crm-card">
                        <h3 className="crm-eyebrow mb-3">Broker emails &amp; calls</h3>
                        <ActivityPanel entityType="deal" entityId={deal.id} hideHeader />
                      </section>
                    </TabsContent>

                    <TabsContent value="activity" className="p-4 mt-0">
                      <ActivityPanel entityType="deal" entityId={deal.id} />
                    </TabsContent>

                    <TabsContent value="files" className="p-4 mt-0">
                      <DealFilesTab dealId={deal.id} workspaceId={deal.workspace_id} />
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Right rail */}
                <aside className="border-l border-border/40 overflow-auto bg-background">
                  <div className="p-6 space-y-8">
                    {/* DEAL INFO */}
                    <section className="space-y-4">
                      <div className="crm-eyebrow">Deal info</div>
                      <div>
                        <Label className="crm-field-label">Stage</Label>
                        <select
                          value={deal.stage_id}
                          onChange={(e) => saveField({ stage_id: e.target.value } as any)}
                          className="w-full text-sm h-9 rounded-md border border-input bg-background px-2 mt-1"
                        >
                          {stages.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className="crm-field-label">Assigned to</Label>
                        <OwnerPicker
                          ownerId={deal.owner_id}
                          onChange={async (id) => {
                            await saveField({ owner_id: id } as any);
                          }}
                        />
                      </div>
                      <div>
                        <Label className="crm-field-label">Source contact</Label>
                        <ContactPicker
                          value={deal.source_contact_id}
                          onChange={(id) => saveField({ source_contact_id: id } as any)}
                          placeholder="Who sent this?"
                        />
                      </div>
                      <div>
                        <Label className="crm-field-label">Disposition strategy</Label>
                        <select
                          value={deal.disposition_strategy ?? ""}
                          onChange={(e) =>
                            saveField({ disposition_strategy: e.target.value || null } as any)
                          }
                          className="w-full text-sm h-9 rounded-md border border-input bg-background px-2 mt-1"
                        >
                          <option value="">Choose a strategy</option>
                          <option value="buy_hold">Buy &amp; Hold</option>
                          <option value="assign">Assign</option>
                          <option value="double_close">Double Close</option>
                          <option value="pass">Pass</option>
                        </select>
                      </div>
                    </section>

                    {/* Team members (Collaborators) */}
                    <section>
                      <DealTeamMembersPanel
                        dealId={deal.id}
                        canManage={canManage}
                        currentUserId={user?.id ?? null}
                      />
                    </section>

                    {/* Contacts */}
                    <section>
                      <div className="flex items-center justify-between mb-3">
                        <div className="crm-eyebrow">Contacts</div>
                        <Popover open={addOpen} onOpenChange={setAddOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                              <Plus className="h-3.5 w-3.5" /> Add
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-72 p-0">
                            <div className="p-2 border-b border-border/40">
                              <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                  value={search}
                                  onChange={(e) => setSearch(e.target.value)}
                                  placeholder="Search contacts…"
                                  className="h-8 pl-7 text-sm"
                                  autoFocus
                                />
                              </div>
                            </div>
                            <div className="max-h-60 overflow-auto">
                              {searchResults
                                .filter((c) => !linkedIds.has(c.id))
                                .map((c) => (
                                  <button
                                    key={c.id}
                                    onClick={() => { linkContact(c.id); setAddOpen(false); setSearch(""); }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50"
                                  >
                                    <div className="font-medium truncate">{contactName(c)}</div>
                                    {c.email && <div className="text-[11px] text-muted-foreground truncate">{c.email}</div>}
                                  </button>
                                ))}
                              {searchResults.length === 0 && search.trim().length >= 2 && (
                                <div className="px-3 py-3 text-xs text-muted-foreground">No matches</div>
                              )}
                            </div>
                            <div className="border-t border-border/40 p-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start gap-2 h-8 text-xs"
                                onClick={() => { setAddOpen(false); setCreateOpen(true); }}
                              >
                                <UserPlus className="h-3.5 w-3.5" /> Create new contact
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      {primaryContact ? (
                        <div className="rounded-md border border-border/50 bg-card p-2 mb-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate flex items-center gap-1.5">
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                {contactName(primaryContact)}
                              </div>
                              {primaryContact.email && (
                                <a href={`mailto:${primaryContact.email}`} className="text-[11px] text-muted-foreground hover:text-primary truncate flex items-center gap-1">
                                  <Mail className="h-3 w-3" /> {primaryContact.email}
                                </a>
                              )}
                            </div>
                            <button
                              onClick={() => unlinkContact(primaryContact.id)}
                              className="text-muted-foreground hover:text-destructive p-1 rounded"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic mb-2">No primary contact.</p>
                      )}
                      {associatedContacts.map((c) => (
                        <div key={c.id} className="rounded-md border border-border/40 bg-card p-2 mb-1">
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
                              <button
                                onClick={() => makePrimary(c.id)}
                                className="text-muted-foreground hover:text-amber-500 p-1 rounded"
                                title="Make primary"
                              >
                                <StarOff className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => unlinkContact(c.id)}
                                className="text-muted-foreground hover:text-destructive p-1 rounded"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </section>

                  </div>
                </aside>
              </div>
          </>
        )}
      </EntitySheetShell>

      {/* Recipient picker dialog */}
      <Dialog open={recipientPickerOpen} onOpenChange={setRecipientPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New email</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Subject</Label>
              <Input value={draftSubject} onChange={(e) => setDraftSubject(e.target.value)} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Recipients</div>
              <div className="space-y-1 max-h-60 overflow-auto">
                {contacts.filter((c) => c.email).map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={pickedIds.has(c.id)}
                      onCheckedChange={(v) => {
                        setPickedIds((prev) => {
                          const next = new Set(prev);
                          if (v) next.add(c.id); else next.delete(c.id);
                          return next;
                        });
                      }}
                    />
                    <span>{contactName(c)}</span>
                    <span className="text-xs text-muted-foreground">{c.email}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRecipientPickerOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={sendNewEmail}>Compose</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ComposeModal
        open={composeOpen}
        onOpenChange={setComposeOpen}
        defaultTo={composeCtx.to}
        defaultSubject={composeCtx.subject}
        threadId={composeCtx.threadId}
        onSent={handleSent}
      />

      <QuickCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={deal?.workspace_id ?? null}
        userId={user?.id ?? null}
        onCreated={async (created) => {
          if (created?.type === "contact" && created.id) await linkContact(created.id);
          setCreateOpen(false);
        }}
      />

      {deal && (
        <NewTransactionDialog
          open={newTxOpen}
          onOpenChange={setNewTxOpen}
          prefillFromDeal={{
            dealId: deal.id,
            property_address: deal.property_address || deal.title,
            property_city: deal.property_city,
            property_state: deal.property_state,
            property_type: deal.property_type,
            units: deal.units,
            asking_price: deal.asking_price ?? deal.value,
            source_contact_id: deal.source_contact_id,
            expected_close_date: deal.expected_close_date,
          }}
          defaultLane="portfolio"
          onCreated={() => {
            toast({ title: "Transaction created", description: "View it in the Transactions tab." });
            onChanged();
          }}
        />
      )}
    </>
  );
}

function DealCustomFieldsPanel({
  dealId,
  values,
  onSaved,
}: {
  dealId: string;
  values: Record<string, unknown>;
  onSaved: (v: Record<string, unknown>) => void;
}) {
  const { fields } = useCustomFields("deal");
  const [draft, setDraft] = useState<Record<string, unknown>>(values);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(values), [dealId]);
  if (fields.length === 0) return null;
  const dirty = JSON.stringify(draft) !== JSON.stringify(values);
  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("deals")
      .update({ custom_fields: draft as any })
      .eq("id", dealId);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    onSaved(draft);
  };
  return (
    <section>
      <div className="crm-eyebrow mb-3">Custom fields</div>
      <CustomFieldsRenderer fields={fields} values={draft} onChange={setDraft} compact />
      {dirty && (
        <div className="flex justify-end mt-2">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}Save
          </Button>
        </div>
      )}
    </section>
  );
}
