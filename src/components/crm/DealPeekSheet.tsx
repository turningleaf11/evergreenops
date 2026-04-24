import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Loader2,
  Mail,
  Phone,
  Briefcase,
  NotebookPen,
  ExternalLink,
  Trash2,
  Reply,
  Send,
  Plus,
  X,
  Star,
  StarOff,
  Search,
  UserPlus,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { formatDistanceToNow } from "date-fns";
import { CustomFieldsRenderer, useCustomFields } from "./CustomFieldsRenderer";
import { ComposeModal } from "@/components/inbox/ComposeModal";
import { QuickCreateDialog } from "./QuickCreateDialog";
import { OwnerPicker, DealTeamMembersPanel } from "./PeoplePickers";

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
interface Activity {
  id: string;
  type: string;
  subject: string;
  body: string;
  occurred_at: string;
  metadata?: Record<string, unknown>;
}

const formatMoney = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);

const contactName = (c: ContactLite) =>
  `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "Untitled";

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
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [editClose, setEditClose] = useState("");

  // Compose modal
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeCtx, setComposeCtx] = useState<{
    to: string;
    subject: string;
    threadId?: string;
  }>({ to: "", subject: "" });

  // Recipient picker (for new-email-from-deal)
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const [draftSubject, setDraftSubject] = useState("");

  // Add-contact popover
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ContactLite[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

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
        .select("id,type,subject,body,occurred_at,metadata")
        .eq("entity_type", "deal")
        .eq("entity_id", dealId)
        .order("occurred_at", { ascending: false })
        .limit(50),
    ]);
    const dealRow = (d as Deal) || null;
    setDeal(dealRow);
    setLinks((ls as LinkRow[]) || []);
    setActivities((acts as Activity[]) || []);
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
    if (!dealId) {
      setDeal(null);
      return;
    }
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
        const [{ data: st }, { data: ls }, { data: acts }] = await Promise.all([
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
            .select("id,type,subject,body,occurred_at,metadata")
            .eq("entity_type", "deal")
            .eq("entity_id", dealRow.id)
            .order("occurred_at", { ascending: false })
            .limit(50),
        ]);
        if (!active) return;
        setStages((st as Stage[]) || []);
        setLinks((ls as LinkRow[]) || []);
        setActivities((acts as Activity[]) || []);
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
    return () => {
      active = false;
    };
  }, [dealId]);

  // Search existing contacts for "Add contact"
  useEffect(() => {
    if (!addOpen || search.trim().length < 2) {
      setSearchResults([]);
      return;
    }
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
    return () => {
      cancelled = true;
    };
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

  const logNote = async () => {
    if (!deal || !noteDraft.trim() || !user) return;
    setSavingNote(true);
    const { data, error } = await supabase
      .from("crm_activities")
      .insert({
        workspace_id: deal.workspace_id,
        entity_type: "deal",
        entity_id: deal.id,
        type: "note",
        body: noteDraft.trim(),
        actor_id: user.id,
      })
      .select()
      .single();
    setSavingNote(false);
    if (error) {
      toast({ title: "Couldn't save note", description: error.message, variant: "destructive" });
      return;
    }
    setActivities((a) => [data as Activity, ...a]);
    setNoteDraft("");
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

  // ----- Contact management -----

  const linkContact = async (contactId: string) => {
    if (!deal || !user) return;
    // If no primary, set as primary (no entity_links row needed)
    if (!deal.primary_contact_id) {
      await saveField({ primary_contact_id: contactId });
    } else if (contactId !== deal.primary_contact_id) {
      // Add as associated link
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
      // Removing primary — promote first associated if any, else clear
      const others = links.map((l) => l.target_id).filter((id) => id !== contactId);
      const newPrimary = others[0] ?? null;
      if (newPrimary) {
        // Remove link row of the new primary (it will be the primary now)
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
      if (link) {
        await supabase.from("entity_links").delete().eq("id", link.id);
      }
    }
    await reload();
  };

  const makePrimary = async (contactId: string) => {
    if (!deal || deal.primary_contact_id === contactId || !user) return;
    const oldPrimary = deal.primary_contact_id;
    // Move old primary into entity_links (associated)
    if (oldPrimary) {
      await supabase.from("entity_links").insert({
        source_type: "deal",
        source_id: deal.id,
        target_type: "contact",
        target_id: oldPrimary,
        created_by: user.id,
      });
    }
    // Remove the new primary's link row
    const link = links.find((l) => l.target_id === contactId);
    if (link) {
      await supabase.from("entity_links").delete().eq("id", link.id);
    }
    await saveField({ primary_contact_id: contactId });
    await reload();
  };

  // ----- Email -----

  const openCompose = (opts: { to: string; subject: string; threadId?: string }) => {
    setComposeCtx(opts);
    setComposeOpen(true);
  };

  const startNewEmail = () => {
    // Pre-select primary, plus any single linked contact if no primary
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
    openCompose({
      to: recipients.join(", "),
      subject: draftSubject,
    });
  };

  const handleSent = async (result: { threadId?: string; id?: string }) => {
    if (!deal || !user || !result.threadId) {
      void reload();
      return;
    }
    // Link thread to deal + every recipient contact (so it appears on each timeline)
    const targets: { entity_type: "deal" | "contact"; entity_id: string }[] = [
      { entity_type: "deal", entity_id: deal.id },
    ];
    contacts
      .filter((c) => pickedIds.has(c.id))
      .forEach((c) => targets.push({ entity_type: "contact", entity_id: c.id }));

    // Dedup: don't duplicate the deal-link if this was a reply on an existing thread
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

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
          {loading || !deal ? (
            <div className="flex items-center justify-center h-full text-muted-foreground gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <SheetTitle className="text-xl flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-primary" />
                      <span className="truncate">{deal.title}</span>
                    </SheetTitle>
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      {currentStage && (
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                          style={{
                            borderColor: `hsl(${currentStage.color})`,
                            color: `hsl(${currentStage.color})`,
                          }}
                        >
                          {currentStage.name}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {deal.status}
                      </Badge>
                      <span className="text-sm font-medium ml-1">
                        {formatMoney(Number(deal.value || 0), deal.currency)}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={startNewEmail}
                    disabled={contacts.filter((c) => c.email).length === 0}
                    title={
                      contacts.filter((c) => c.email).length === 0
                        ? "No linked contact has an email"
                        : "Send email about this deal"
                    }
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" /> Email
                  </Button>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-auto">
                {/* Quick edits */}
                <div className="px-6 py-4 grid grid-cols-2 gap-3 border-b border-border/50">
                  <div>
                    <Label className="text-xs">Value</Label>
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => {
                        const n = Number(editValue.replace(/[^0-9.\-]/g, "")) || 0;
                        if (n !== Number(deal.value)) saveField({ value: n });
                      }}
                      inputMode="decimal"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Expected close</Label>
                    <Input
                      type="date"
                      value={editClose}
                      onChange={(e) => setEditClose(e.target.value)}
                      onBlur={() => {
                        if ((editClose || null) !== (deal.expected_close_date || null)) {
                          saveField({ expected_close_date: editClose || null });
                        }
                      }}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Stage</Label>
                    <select
                      value={deal.stage_id}
                      onChange={(e) => {
                        const newStageId = e.target.value;
                        const stage = stages.find((s) => s.id === newStageId);
                        const patch: Partial<Deal> = { stage_id: newStageId };
                        if (stage?.is_won) patch.status = "won";
                        else if (stage?.is_lost) patch.status = "lost";
                        else patch.status = "open";
                        saveField(patch);
                      }}
                      className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      {stages.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {deal.status === "lost" && (
                    <div className="col-span-2">
                      <Label className="text-xs">Lost reason</Label>
                      <Input
                        defaultValue={deal.lost_reason ?? ""}
                        onBlur={(e) => {
                          if (e.target.value !== (deal.lost_reason ?? ""))
                            saveField({ lost_reason: e.target.value });
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Linked contacts */}
                <div className="px-6 py-4 border-b border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Contacts
                    </div>
                    <Popover open={addOpen} onOpenChange={setAddOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                          <Plus className="h-3.5 w-3.5" /> Add
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-80 p-0">
                        <div className="px-3 py-2 border-b border-border/40">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              autoFocus
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                              placeholder="Search contacts…"
                              className="h-8 text-sm pl-7"
                            />
                          </div>
                        </div>
                        <div className="max-h-60 overflow-auto">
                          {search.trim().length >= 2 && searchResults.length === 0 && (
                            <div className="py-3 text-center text-xs text-muted-foreground">
                              No matches
                            </div>
                          )}
                          {searchResults
                            .filter((c) => !linkedIds.has(c.id))
                            .map((c) => (
                              <button
                                key={c.id}
                                onClick={async () => {
                                  await linkContact(c.id);
                                  setAddOpen(false);
                                  setSearch("");
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0">
                                  <div className="truncate font-medium">{contactName(c)}</div>
                                  {c.email && (
                                    <div className="truncate text-[11px] text-muted-foreground">
                                      {c.email}
                                    </div>
                                  )}
                                </div>
                                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            ))}
                        </div>
                        <div className="border-t border-border/40 px-3 py-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-7 gap-1"
                            onClick={() => {
                              setAddOpen(false);
                              setCreateOpen(true);
                            }}
                          >
                            <UserPlus className="h-3.5 w-3.5" /> New contact
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {contacts.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No contacts linked yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {primaryContact && (
                        <ContactRow
                          contact={primaryContact}
                          isPrimary
                          onMakePrimary={() => {}}
                          onUnlink={() => unlinkContact(primaryContact.id)}
                        />
                      )}
                      {associatedContacts.map((c) => (
                        <ContactRow
                          key={c.id}
                          contact={c}
                          isPrimary={false}
                          onMakePrimary={() => makePrimary(c.id)}
                          onUnlink={() => unlinkContact(c.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Note */}
                <div className="px-6 py-4 border-b border-border/50">
                  <div className="flex items-center gap-2 mb-2">
                    <NotebookPen className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Log a note
                    </span>
                  </div>
                  <Textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    rows={3}
                    placeholder="Update on this deal…"
                    className="text-sm"
                  />
                  <div className="flex justify-end mt-2">
                    <Button size="sm" onClick={logNote} disabled={savingNote || !noteDraft.trim()}>
                      {savingNote && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      Save note
                    </Button>
                  </div>
                </div>

                {deal && (
                  <DealCustomFieldsPanel
                    dealId={deal.id}
                    values={(deal.custom_fields || {}) as Record<string, unknown>}
                    onSaved={(v) => setDeal({ ...deal, custom_fields: v })}
                  />
                )}

                {/* Activity */}
                <div className="px-6 py-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
                    Activity
                  </div>
                  {activities.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      No activity yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {activities.map((a) => {
                        const threadId = (a.metadata as any)?.gmail_thread_id as
                          | string
                          | undefined;
                        const isEmail = a.type === "email" && threadId;
                        return (
                          <div
                            key={a.id}
                            className="rounded-lg border border-border/40 bg-card p-3 text-sm"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] uppercase tracking-wide text-muted-foreground capitalize">
                                {a.type}
                              </span>
                              <div className="flex items-center gap-2">
                                {isEmail && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-[11px]"
                                    onClick={() => {
                                      // Reply to-all linked contacts on this thread
                                      const recipients = contacts
                                        .map((c) => c.email)
                                        .filter(Boolean) as string[];
                                      const initial = new Set<string>();
                                      contacts
                                        .filter((c) => !!c.email)
                                        .forEach((c) => initial.add(c.id));
                                      setPickedIds(initial);
                                      openCompose({
                                        to: recipients.join(", "),
                                        subject: a.subject?.toLowerCase().startsWith("re:")
                                          ? a.subject
                                          : `Re: ${a.subject || ""}`,
                                        threadId,
                                      });
                                    }}
                                  >
                                    <Reply className="h-3 w-3 mr-1" /> Reply
                                  </Button>
                                )}
                                {isEmail && (
                                  <Link
                                    to={`/inbox?thread=${threadId}`}
                                    className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-0.5"
                                    title="Open in inbox"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </Link>
                                )}
                                <span className="text-[11px] text-muted-foreground">
                                  {formatDistanceToNow(new Date(a.occurred_at), {
                                    addSuffix: true,
                                  })}
                                </span>
                              </div>
                            </div>
                            {a.subject && <div className="font-medium mb-0.5">{a.subject}</div>}
                            {a.body && (
                              <p className="whitespace-pre-wrap text-muted-foreground">{a.body}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-3 border-t border-border/50 flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete deal
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Recipient picker dialog (for new emails) */}
      <Dialog open={recipientPickerOpen} onOpenChange={setRecipientPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">New email about this deal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Subject</Label>
              <Input
                value={draftSubject}
                onChange={(e) => setDraftSubject(e.target.value)}
                placeholder="Subject"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Send to</Label>
              <div className="space-y-1 max-h-60 overflow-auto rounded-md border border-border/40 p-2 mt-1">
                {contacts.length === 0 && (
                  <div className="text-xs text-muted-foreground py-2 text-center">
                    No linked contacts
                  </div>
                )}
                {contacts.map((c) => {
                  const checked = pickedIds.has(c.id);
                  const disabled = !c.email;
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${
                        disabled ? "opacity-40" : "hover:bg-muted/40 cursor-pointer"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={(v) => {
                          setPickedIds((prev) => {
                            const next = new Set(prev);
                            if (v) next.add(c.id);
                            else next.delete(c.id);
                            return next;
                          });
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate font-medium">{contactName(c)}</span>
                          {deal?.primary_contact_id === c.id && (
                            <Star className="h-3 w-3 text-primary shrink-0" />
                          )}
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {c.email || "no email"}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setRecipientPickerOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={sendNewEmail}>
              Continue
            </Button>
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
        initialTab="contact"
        onCreated={async ({ type, id }) => {
          if (type === "contact") {
            await linkContact(id);
          }
        }}
      />
    </>
  );
}

function ContactRow({
  contact,
  isPrimary,
  onMakePrimary,
  onUnlink,
}: {
  contact: ContactLite;
  isPrimary: boolean;
  onMakePrimary: () => void;
  onUnlink: () => void;
}) {
  const name = contactName(contact);
  return (
    <div
      className={`flex items-center justify-between gap-2 text-sm rounded-md border px-2.5 py-1.5 ${
        isPrimary ? "border-primary/40 bg-primary/5" : "border-border/40"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {isPrimary && <Star className="h-3 w-3 text-primary shrink-0" />}
          <span className="font-medium truncate">{name}</span>
          {isPrimary && (
            <Badge variant="outline" className="text-[9px] h-4 px-1 ml-1">
              Primary
            </Badge>
          )}
        </div>
        {contact.email && (
          <div className="text-[11px] text-muted-foreground truncate">{contact.email}</div>
        )}
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="hover:text-primary inline-flex items-center gap-1 px-1"
            title="Mailto"
          >
            <Mail className="h-3 w-3" />
          </a>
        )}
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            className="hover:text-primary inline-flex items-center gap-1 px-1"
            title="Call"
          >
            <Phone className="h-3 w-3" />
          </a>
        )}
        {!isPrimary && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Make primary"
            onClick={onMakePrimary}
          >
            <StarOff className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          title="Unlink"
          onClick={onUnlink}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
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
      .update({ custom_fields: draft as any } as any)
      .eq("id", dealId);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    onSaved(draft);
  };
  return (
    <div className="px-6 py-4 border-b border-border/50">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
        Custom fields
      </div>
      <CustomFieldsRenderer fields={fields} values={draft} onChange={setDraft} compact />
      {dirty && (
        <div className="flex justify-end mt-2">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}Save
          </Button>
        </div>
      )}
    </div>
  );
}
