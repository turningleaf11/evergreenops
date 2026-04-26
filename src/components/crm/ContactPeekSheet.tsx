import { useEffect, useState } from "react";
import { Loader2, Mail, Phone, Send, X, Inbox, Briefcase, Sparkles, ExternalLink, MoreHorizontal, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { CustomFieldsRenderer, useCustomFields } from "./CustomFieldsRenderer";
import { InlineEmailComposer } from "./InlineEmailComposer";
import { OwnerPicker } from "./PeoplePickers";
import { type ComposerSubmit } from "./CrmComposerTabs";
import {
  type TimelineActivity,
} from "./CrmActivityTimeline";
import ActivityPanel from "@/components/activity/ActivityPanel";
import {
  CONTACT_TYPES,
  CONTACT_TYPE_LABEL,
  CONTACT_TYPE_COLOR,
  PREFERRED_CONTACT_METHODS,
  type ContactType,
  type PreferredContactMethod,
} from "./contactTypes";
import {
  EntitySheetShell,
  EntitySheetHeader,
  EntityIdentityStrip,
  EntityStatusPill,
  EntitySectionHeader,
  EntityTabs,
  EntityTabPanel,
  EntityDetailLayout,
  EntitySidebarSection,
  EntitySidebarField,
  EntityEmpty,
  type EntityTabId,
} from "./_shell";
import { cn } from "@/lib/utils";
import { LinkRecordPopover } from "./LinkRecordPopover";

interface Contact {
  id: string;
  workspace_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  status: string;
  notes: string;
  company_id: string | null;
  owner_id: string | null;
  last_contacted_at: string | null;
  custom_fields: Record<string, unknown>;
  created_at: string;
  contact_type: string | null;
  preferred_contact_method: string | null;
  buy_box_notes: string | null;
  markets: string[] | null;
  is_active: boolean;
}

interface Person { user_id: string; full_name: string | null; avatar_url?: string | null }

export function ContactPeekSheet({
  contactId,
  onClose,
  onChanged,
}: {
  contactId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);
  const [activities, setActivities] = useState<TimelineActivity[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [linkedDeals, setLinkedDeals] = useState<Array<{ id: string; name: string; stage: string | null; status: string | null }>>([]);
  const [linkedLeads, setLinkedLeads] = useState<Array<{ id: string; address: string | null; status: string | null }>>([]);
  const [tab, setTab] = useState<EntityTabId>("overview");

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeCtx, setComposeCtx] = useState<{ to: string; subject: string; threadId?: string }>({
    to: "",
    subject: "",
  });

  const reload = async () => {
    if (!contactId) return;
    const { data: acts } = await supabase
      .from("crm_activities")
      .select("id,type,subject,body,occurred_at,actor_id,metadata")
      .eq("entity_type", "contact")
      .eq("entity_id", contactId)
      .order("occurred_at", { ascending: false })
      .limit(200);
    setActivities((acts as TimelineActivity[]) || []);
  };

  useEffect(() => {
    if (!contactId) {
      setContact(null);
      setActivities([]);
      setLinkedDeals([]);
      setLinkedLeads([]);
      setCompanyName(null);
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      const [{ data: c }, { data: acts }, { data: p }, { data: deals }, { data: leads }] = await Promise.all([
        supabase.from("contacts").select("*").eq("id", contactId).maybeSingle(),
        supabase
          .from("crm_activities")
          .select("id,type,subject,body,occurred_at,actor_id,metadata")
          .eq("entity_type", "contact")
          .eq("entity_id", contactId)
          .order("occurred_at", { ascending: false })
          .limit(200),
        supabase.from("profiles").select("user_id,full_name,avatar_url").limit(500),
        supabase
          .from("deals")
          .select("id,name,stage,status,primary_contact_id,source_contact_id")
          .or(`primary_contact_id.eq.${contactId},source_contact_id.eq.${contactId}`)
          .order("created_at", { ascending: false })
          .limit(25),
        supabase
          .from("leads")
          .select("id,address_line1,status,source_contact_id,created_at")
          .eq("source_contact_id", contactId)
          .order("created_at", { ascending: false })
          .limit(25),
      ]);
      if (!active) return;
      const contactRow = (c as Contact) || null;
      setContact(contactRow);
      setActivities((acts as TimelineActivity[]) || []);
      setPeople((p as Person[]) || []);
      setLinkedDeals(((deals as any[]) || []).map((d) => ({ id: d.id, name: d.name, stage: d.stage, status: d.status })));
      setLinkedLeads(((leads as any[]) || []).map((l) => ({ id: l.id, address: l.address_line1, status: l.status })));

      if (contactRow?.company_id) {
        const { data: comp } = await supabase
          .from("companies")
          .select("name")
          .eq("id", contactRow.company_id)
          .maybeSingle();
        if (active) setCompanyName((comp as any)?.name ?? null);
      } else {
        setCompanyName(null);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [contactId]);

  const handleComposerSubmit = async (payload: ComposerSubmit) => {
    if (!contact || !user) return;
    let subject = "";
    const body = payload.body;
    const type: string = payload.type;
    if (payload.type === "call") {
      subject = `Call · ${payload.outcome.replace("_", " ")} · ${payload.durationMin}m`;
    }
    const { data, error } = await supabase
      .from("crm_activities")
      .insert({
        workspace_id: contact.workspace_id,
        entity_type: "contact",
        entity_id: contact.id,
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

  const openCompose = (opts: { to: string; subject: string; threadId?: string }) => {
    setComposeCtx(opts);
    setComposeOpen(true);
  };

  const handleSent = async (result: { threadId?: string; id?: string }) => {
    if (!contact || !user || !result.threadId) {
      void reload();
      return;
    }
    const { data: existing } = await supabase
      .from("email_links")
      .select("id")
      .eq("gmail_thread_id", result.threadId)
      .eq("entity_type", "contact")
      .eq("entity_id", contact.id)
      .maybeSingle();
    if (!existing) {
      await supabase.from("email_links").insert({
        workspace_id: contact.workspace_id,
        gmail_thread_id: result.threadId,
        gmail_message_id: result.id ?? null,
        entity_type: "contact",
        entity_id: contact.id,
        subject: composeCtx.subject.slice(0, 500),
        snippet: "",
        linked_by: user.id,
      });
    }
    void reload();
  };

  const isOpen = !!contactId;
  const canEmail = !!contact?.email;
  const fullName = contact
    ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "Untitled contact"
    : "";

  const lastContacted = contact?.last_contacted_at
    ? formatDistanceToNow(new Date(contact.last_contacted_at), { addSuffix: true })
    : null;

  const hasCustomFields = !!(contact?.custom_fields && Object.keys(contact.custom_fields).length > 0);

  const typeColor = CONTACT_TYPE_COLOR[(contact?.contact_type as ContactType) || "other"];
  const typeLabel = CONTACT_TYPE_LABEL[(contact?.contact_type as ContactType) || "other"];

  const subtitleParts: string[] = [];
  if (companyName) subtitleParts.push(companyName);
  if (contact?.contact_type) subtitleParts.push(typeLabel);

  const updateContact = async (patch: Partial<Contact>) => {
    if (!contact) return;
    const { error } = await supabase.from("contacts").update(patch as any).eq("id", contact.id);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    setContact({ ...contact, ...patch });
    onChanged();
  };

  const linkDeal = async (dealId: string) => {
    if (!contact) return;
    const { error } = await supabase
      .from("deals")
      .update({ source_contact_id: contact.id })
      .eq("id", dealId);
    if (error) {
      toast({ title: "Couldn't link deal", description: error.message, variant: "destructive" });
      return;
    }
    const { data: d } = await supabase
      .from("deals")
      .select("id,title,status")
      .eq("id", dealId)
      .maybeSingle();
    if (d) {
      const row = d as any;
      setLinkedDeals((prev) => [{ id: row.id, name: row.title, stage: null, status: row.status }, ...prev]);
    }
    onChanged();
  };

  const linkLead = async (leadId: string) => {
    if (!contact) return;
    const { error } = await supabase
      .from("leads")
      .update({ source_contact_id: contact.id })
      .eq("id", leadId);
    if (error) {
      toast({ title: "Couldn't link lead", description: error.message, variant: "destructive" });
      return;
    }
    const { data: l } = await supabase
      .from("leads")
      .select("id,property_address,status")
      .eq("id", leadId)
      .maybeSingle();
    if (l) {
      const row = l as any;
      setLinkedLeads((prev) => [{ id: row.id, address: row.property_address, status: row.status }, ...prev]);
    }
    onChanged();
  };

  return (
    <>
      <EntitySheetShell
        open={isOpen}
        onOpenChange={(v) => !v && onClose()}
        loading={loading || !contact}
        width="wide"
      >
        {contact && (
          <>
            <EntitySheetHeader
              title={fullName}
              subtitle={subtitleParts.length ? subtitleParts.join(" · ") : undefined}
              titleClassName="text-[20px] font-semibold"
              onClose={onClose}
              actions={
                <>
                  <Badge
                    className="border-transparent font-semibold"
                    style={{
                      backgroundColor: `hsl(${typeColor} / 0.15)`,
                      color: `hsl(${typeColor})`,
                      borderRadius: 100,
                      padding: "3px 10px",
                      fontSize: 11,
                    }}
                  >
                    {typeLabel}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-semibold",
                      contact.is_active === false
                        ? "text-muted-foreground border-muted-foreground/40"
                        : "text-brand-mint-deep border-brand-mint/40 bg-brand-mint/10",
                    )}
                    style={{ borderRadius: 100, padding: "3px 10px", fontSize: 11 }}
                  >
                    {contact.is_active === false ? "Inactive" : "Active"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canEmail}
                    onClick={() => {
                      setComposeCtx({ to: contact.email!, subject: "" });
                      setComposeOpen(true);
                    }}
                    className="h-8 gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" /> Email
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </>
              }
            />

            {composeOpen ? (
              <InlineEmailComposer
                defaultTo={composeCtx.to}
                defaultSubject={composeCtx.subject}
                threadId={composeCtx.threadId}
                onClose={() => setComposeOpen(false)}
                onSent={handleSent}
              />
            ) : (
              <EntityTabs
                value={tab}
                onValueChange={(v) => setTab(v)}
                hide={["deals", "more"]}
              >
                <EntityTabPanel value="overview" className="p-0 overflow-hidden">
                  <EntityDetailLayout
                    main={
                      <div className="space-y-7">
                        <ContactDetailsBlock
                          contact={contact}
                          companyName={companyName}
                          onChange={(patch) => setContact({ ...contact, ...patch })}
                          onCompanyChange={(name) => setCompanyName(name)}
                          onChanged={onChanged}
                        />
                        <ContactNotesBlock
                          contact={contact}
                          onSaved={(patch) => setContact({ ...contact, ...patch })}
                          onChanged={onChanged}
                        />
                        <ContactMarketsSection
                          contact={contact}
                          onSaved={(patch) => setContact({ ...contact, ...patch })}
                          onChanged={onChanged}
                        />
                        {hasCustomFields && (
                          <section>
                            <SectionLabel>Custom fields</SectionLabel>
                            <CustomFieldsPanel
                              contactId={contact.id}
                              values={(contact.custom_fields || {}) as Record<string, unknown>}
                              onSaved={(v) => setContact({ ...contact, custom_fields: v })}
                            />
                          </section>
                        )}
                      </div>
                    }
                    sidebar={
                      <ContactSidebar
                        contact={contact}
                        companyName={companyName}
                        deals={linkedDeals}
                        leads={linkedLeads}
                        lastContacted={lastContacted}
                        onUpdate={updateContact}
                        onChanged={onChanged}
                        setContact={setContact}
                        onLinkDeal={linkDeal}
                        onLinkLead={linkLead}
                      />
                    }
                  />
                </EntityTabPanel>

                <EntityTabPanel value="activity" className="p-0 overflow-hidden">
                  <EntityDetailLayout
                    mainClassName="overflow-hidden p-6"
                    mainInnerClassName="!max-w-none !space-y-0 h-full"
                    main={
                      <div
                        className="h-full flex flex-col bg-card rounded-xl overflow-hidden"
                        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                      >
                        <div className="flex-1 min-h-0 flex flex-col p-5">
                          <ActivityPanel entityType="contact" entityId={contact.id} hideHeader />
                        </div>
                      </div>
                    }
                    sidebar={
                      <ContactSidebar
                        contact={contact}
                        companyName={companyName}
                        deals={linkedDeals}
                        leads={linkedLeads}
                        lastContacted={lastContacted}
                        onUpdate={updateContact}
                        onChanged={onChanged}
                        setContact={setContact}
                        onLinkDeal={linkDeal}
                        onLinkLead={linkLead}
                      />
                    }
                  />
                </EntityTabPanel>

                <EntityTabPanel value="files" className="p-0 overflow-hidden">
                  <EntityDetailLayout
                    main={
                      <div className="rounded-xl bg-card flex flex-col items-center justify-center py-16 text-center text-sm text-muted-foreground" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                        <Inbox className="h-8 w-8 mb-2 opacity-50" />
                        <p className="font-medium text-foreground mb-1">No files yet</p>
                        <p>File attachments for contacts will appear here.</p>
                      </div>
                    }
                    sidebar={
                      <ContactSidebar
                        contact={contact}
                        companyName={companyName}
                        deals={linkedDeals}
                        leads={linkedLeads}
                        lastContacted={lastContacted}
                        onUpdate={updateContact}
                        onChanged={onChanged}
                        setContact={setContact}
                        onLinkDeal={linkDeal}
                        onLinkLead={linkLead}
                      />
                    }
                  />
                </EntityTabPanel>
              </EntityTabs>
            )}
          </>
        )}
      </EntitySheetShell>
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Right sidebar — Assignment / Status / Key Details / Linked Records
// ───────────────────────────────────────────────────────────────────────
function ContactSidebar({
  contact,
  companyName,
  deals,
  leads,
  lastContacted,
  onUpdate,
  onChanged,
  setContact,
  onLinkDeal,
  onLinkLead,
}: {
  contact: Contact;
  companyName: string | null;
  deals: Array<{ id: string; name: string; stage: string | null; status: string | null }>;
  leads: Array<{ id: string; address: string | null; status: string | null }>;
  lastContacted: string | null;
  onUpdate: (patch: Partial<Contact>) => Promise<void>;
  onChanged: () => void;
  setContact: (c: Contact) => void;
  onLinkDeal?: (dealId: string) => Promise<void> | void;
  onLinkLead?: (leadId: string) => Promise<void> | void;
}) {
  return (
    <>
      <EntitySidebarSection title="Assignment">
        <OwnerPicker
          ownerId={contact.owner_id}
          onChange={async (id) => {
            await onUpdate({ owner_id: id });
          }}
        />
      </EntitySidebarSection>

      <EntitySidebarSection title="Status">
        <EntitySidebarField label="Type">
          <ContactTypeChip
            value={(contact.contact_type as ContactType) || "other"}
            onChange={(v) => onUpdate({ contact_type: v })}
          />
        </EntitySidebarField>
        <EntitySidebarField label="Active">
          <button
            type="button"
            onClick={() => onUpdate({ is_active: !(contact.is_active !== false) })}
            className="inline-flex items-center gap-2 text-sm hover:text-foreground transition-colors"
            title="Toggle active"
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                contact.is_active !== false ? "bg-brand-mint-deep" : "bg-muted-foreground/40",
              )}
            />
            <span className={contact.is_active !== false ? "text-foreground" : "text-muted-foreground"}>
              {contact.is_active !== false ? "Active" : "Inactive"}
            </span>
          </button>
        </EntitySidebarField>
      </EntitySidebarSection>

      <EntitySidebarSection title="Key details">
        <EntitySidebarField label="Preferred contact">
          <PreferredContactChip
            value={contact.preferred_contact_method || null}
            onChange={(v) =>
              onUpdate({
                preferred_contact_method: v as PreferredContactMethod | null,
              })
            }
          />
        </EntitySidebarField>
        {lastContacted && (
          <EntitySidebarField label="Last contacted">
            <span className="text-sm">{lastContacted}</span>
          </EntitySidebarField>
        )}
      </EntitySidebarSection>

      <EntitySidebarSection
        title={`Linked deals (${deals.length})`}
        action={
          onLinkDeal ? (
            <LinkRecordPopover
              kind="deal"
              excludeIds={deals.map((d) => d.id)}
              onPick={(it) => onLinkDeal(it.id)}
            />
          ) : undefined
        }
      >
        {deals.length === 0 ? (
          onLinkDeal ? (
            <LinkRecordPopover
              kind="deal"
              excludeIds={[]}
              onPick={(it) => onLinkDeal(it.id)}
              triggerLabel="Link deal"
            />
          ) : (
            <EntityEmpty>No deals linked.</EntityEmpty>
          )
        ) : (
          <ul className="space-y-1.5">
            {deals.slice(0, 5).map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40 text-sm min-w-0"
              >
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{d.name}</span>
              </li>
            ))}
          </ul>
        )}
      </EntitySidebarSection>

      <EntitySidebarSection
        title={`Linked leads (${leads.length})`}
        action={
          onLinkLead ? (
            <LinkRecordPopover
              kind="lead"
              excludeIds={leads.map((l) => l.id)}
              onPick={(it) => onLinkLead(it.id)}
            />
          ) : undefined
        }
      >
        {leads.length === 0 ? (
          <EntityEmpty>No leads linked.</EntityEmpty>
        ) : (
          <ul className="space-y-1.5">
            {leads.slice(0, 5).map((l) => (
              <li
                key={l.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40 text-sm min-w-0"
              >
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{l.address || "Untitled lead"}</span>
              </li>
            ))}
          </ul>
        )}
      </EntitySidebarSection>
    </>
  );
}


function CustomFieldsPanel({
  contactId,
  values,
  onSaved,
}: {
  contactId: string;
  values: Record<string, unknown>;
  onSaved: (v: Record<string, unknown>) => void;
}) {
  const { fields } = useCustomFields("contact");
  const [draft, setDraft] = useState<Record<string, unknown>>(values);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(values), [contactId]);
  if (fields.length === 0) return null;
  const dirty = JSON.stringify(draft) !== JSON.stringify(values);
  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("contacts")
      .update({ custom_fields: draft as any })
      .eq("id", contactId);
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

// ───────────────────────────────────────────────────────────────────────
// Overview sub-sections
// ───────────────────────────────────────────────────────────────────────

function FieldCell({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
        {label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function ContactInfoGrid({
  contact,
  onSaved,
  onChanged,
}: {
  contact: Contact;
  onSaved: (patch: Partial<Contact>) => void;
  onChanged: () => void;
}) {
  const [contactType, setContactType] = useState<ContactType>(
    (contact.contact_type as ContactType) || "other",
  );
  const [method, setMethod] = useState<string>(contact.preferred_contact_method || "");
  const [isActive, setIsActive] = useState<boolean>(contact.is_active !== false);

  useEffect(() => {
    setContactType((contact.contact_type as ContactType) || "other");
    setMethod(contact.preferred_contact_method || "");
    setIsActive(contact.is_active !== false);
  }, [contact.id]);

  const updateField = async (patch: Partial<Contact>) => {
    const { error } = await supabase.from("contacts").update(patch as any).eq("id", contact.id);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    onSaved(patch);
    onChanged();
  };

  return (
    <section className="rounded-xl bg-card p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <EntitySectionHeader>Contact info</EntitySectionHeader>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <FieldCell label="Phone">
          {contact.phone ? (
            <a href={`tel:${contact.phone}`} className="hover:text-primary transition-colors">
              {contact.phone}
            </a>
          ) : (
            <EntityEmpty>—</EntityEmpty>
          )}
        </FieldCell>

        <FieldCell label="Email">
          {contact.email ? (
            <a
              href={`mailto:${contact.email}`}
              className="hover:text-primary transition-colors break-all"
            >
              {contact.email}
            </a>
          ) : (
            <EntityEmpty>—</EntityEmpty>
          )}
        </FieldCell>

        <FieldCell label="Type">
          <Select
            value={contactType}
            onValueChange={(v) => {
              const next = v as ContactType;
              setContactType(next);
              void updateField({ contact_type: next });
            }}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTACT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {CONTACT_TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldCell>

        <FieldCell label="Preferred contact">
          <Select
            value={method || "_none"}
            onValueChange={(v) => {
              const next = v === "_none" ? "" : v;
              setMethod(next);
              void updateField({
                preferred_contact_method: (next || null) as PreferredContactMethod | null,
              });
            }}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">—</SelectItem>
              {PREFERRED_CONTACT_METHODS.map((m) => (
                <SelectItem key={m} value={m} className="capitalize">
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldCell>

        <FieldCell label="Active">
          <div className="flex items-center h-8">
            <Switch
              checked={isActive}
              onCheckedChange={(next) => {
                setIsActive(next);
                void updateField({ is_active: next });
              }}
            />
            <span className="ml-2 text-xs text-muted-foreground">
              {isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </FieldCell>
      </div>
    </section>
  );
}

function ContactRelationshipNotes({
  contact,
  onSaved,
  onChanged,
}: {
  contact: Contact;
  onSaved: (patch: Partial<Contact>) => void;
  onChanged: () => void;
}) {
  const [buyBox, setBuyBox] = useState<string>(contact.buy_box_notes || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBuyBox(contact.buy_box_notes || "");
  }, [contact.id]);

  const dirty = buyBox !== (contact.buy_box_notes || "");

  const save = async () => {
    setSaving(true);
    const patch = { buy_box_notes: buyBox.trim() || null };
    const { error } = await supabase.from("contacts").update(patch).eq("id", contact.id);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    onSaved(patch);
    onChanged();
  };

  return (
    <section>
      <EntitySectionHeader>Relationship notes</EntitySectionHeader>
      <Textarea
        rows={4}
        value={buyBox}
        onChange={(e) => setBuyBox(e.target.value)}
        onBlur={() => { if (dirty) void save(); }}
        className="text-sm resize-none"
        placeholder="What do they buy? How do they work? Deal quality notes…"
      />
      {saving && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving…
        </div>
      )}
    </section>
  );
}

function ContactMarketsSection({
  contact,
  onSaved,
  onChanged,
}: {
  contact: Contact;
  onSaved: (patch: Partial<Contact>) => void;
  onChanged: () => void;
}) {
  const [markets, setMarkets] = useState<string[]>(contact.markets || []);
  const [marketDraft, setMarketDraft] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setMarkets(contact.markets || []);
  }, [contact.id]);

  const persist = async (next: string[]) => {
    const patch = { markets: next.length ? next : null };
    const { error } = await supabase.from("contacts").update(patch).eq("id", contact.id);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    onSaved(patch);
    onChanged();
  };

  const addMarket = () => {
    const v = marketDraft.trim();
    if (!v) {
      setAdding(false);
      return;
    }
    if (markets.includes(v)) {
      setMarketDraft("");
      setAdding(false);
      return;
    }
    const next = [...markets, v];
    setMarkets(next);
    setMarketDraft("");
    setAdding(false);
    void persist(next);
  };

  const removeMarket = (m: string) => {
    const next = markets.filter((x) => x !== m);
    setMarkets(next);
    void persist(next);
  };

  return (
    <section>
      <EntitySectionHeader>Markets</EntitySectionHeader>
      <div className="flex flex-wrap items-center gap-1.5">
        {markets.map((m) => (
          <span
            key={m}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-brand-azure text-white"
          >
            {m}
            <button
              type="button"
              onClick={() => removeMarket(m)}
              className="opacity-70 hover:opacity-100"
              aria-label={`Remove ${m}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {adding ? (
          <Input
            autoFocus
            value={marketDraft}
            onChange={(e) => setMarketDraft(e.target.value)}
            onBlur={addMarket}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addMarket();
              } else if (e.key === "Escape") {
                setMarketDraft("");
                setAdding(false);
              }
            }}
            className="h-7 text-xs w-32"
            placeholder="Market name"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
          >
            + Add market
          </button>
        )}
      </div>
    </section>
  );
}

function ContactLinkedActivity({
  deals,
  leads,
  lastContacted,
  onViewAll,
}: {
  deals: Array<{ id: string; name: string; stage: string | null; status: string | null }>;
  leads: Array<{ id: string; address: string | null; status: string | null }>;
  lastContacted: string | null;
  onViewAll: () => void;
}) {
  const hasAny = deals.length > 0 || leads.length > 0 || !!lastContacted;
  return (
    <section>
      <EntitySectionHeader>Linked activity</EntitySectionHeader>
      {!hasAny ? (
        <p className="text-xs text-muted-foreground">No linked deals or leads yet.</p>
      ) : (
        <ul className="space-y-2">
          {deals.length > 0 && (
            <li className="flex items-start gap-2.5 text-sm">
              <Briefcase className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {deals.length} deal{deals.length === 1 ? "" : "s"} sourced
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {deals.slice(0, 3).map((d) => d.name).join(" · ")}
                </div>
              </div>
            </li>
          )}
          {leads.length > 0 && (
            <li className="flex items-start gap-2.5 text-sm">
              <Sparkles className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {leads.length} lead{leads.length === 1 ? "" : "s"} sent
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {leads.slice(0, 3).map((l) => l.address || "Untitled").join(" · ")}
                </div>
              </div>
            </li>
          )}
          {lastContacted && (
            <li className="flex items-start gap-2.5 text-sm">
              <ExternalLink className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">Last contacted</div>
                <div className="text-xs text-muted-foreground">{lastContacted}</div>
              </div>
            </li>
          )}
        </ul>
      )}
      {(deals.length > 0 || leads.length > 0) && (
        <button
          type="button"
          onClick={onViewAll}
          className="mt-3 text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
        >
          View all <ExternalLink className="h-3 w-3" />
        </button>
      )}
    </section>
  );
}

function ContactDealsLeadsTab({
  deals,
  leads,
}: {
  deals: Array<{ id: string; name: string; stage: string | null; status: string | null }>;
  leads: Array<{ id: string; address: string | null; status: string | null }>;
}) {
  if (deals.length === 0 && leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-sm text-muted-foreground">
        <Briefcase className="h-8 w-8 mb-2 opacity-50" />
        <p className="font-medium text-foreground mb-1">No linked deals or leads</p>
        <p>Deals and leads associated with this contact will appear here.</p>
      </div>
    );
  }
  return (
    <div className="space-y-7">
      <section>
        <EntitySectionHeader>Deals ({deals.length})</EntitySectionHeader>
        {deals.length === 0 ? (
          <p className="text-xs text-muted-foreground">No deals yet.</p>
        ) : (
          <ul className="divide-y divide-border/50 rounded-md border border-border/50">
            {deals.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{d.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {d.stage && <EntityStatusPill kind="deal_stage" value={d.stage} />}
                  {d.status && <EntityStatusPill kind="deal_status" value={d.status} variant="outline" />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <EntitySectionHeader>Leads ({leads.length})</EntitySectionHeader>
        {leads.length === 0 ? (
          <p className="text-xs text-muted-foreground">No leads yet.</p>
        ) : (
          <ul className="divide-y divide-border/50 rounded-md border border-border/50">
            {leads.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{l.address || "Untitled lead"}</span>
                </div>
                {l.status && (
                  <EntityStatusPill kind="lead_status" value={l.status} variant="outline" />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

