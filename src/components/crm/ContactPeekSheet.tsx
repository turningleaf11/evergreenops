import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Mail, Phone, Send, X, Inbox, Briefcase, Sparkles, ExternalLink, MoreHorizontal, ArrowRight, Building2, Search, MessageSquare, Smartphone, Pencil, MapPin } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { EditableLineField } from "./EditableLineField";
import { NewDealDialog } from "./NewDealDialog";
import { NewLeadDialog } from "./NewLeadDialog";

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
  source: string | null;
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
  const [createDealOpen, setCreateDealOpen] = useState(false);
  const [createLeadOpen, setCreateLeadOpen] = useState(false);
  const [defaultPipelineId, setDefaultPipelineId] = useState<string | null>(null);

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
      const [{ data: c }, { data: acts }, { data: p }, { data: directDeals }, { data: linkedDealRows }, { data: directLeads }, { data: linkedLeadRows }] = await Promise.all([
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
          .select("id,title,stage_id,status,primary_contact_id,source_contact_id")
          .or(`primary_contact_id.eq.${contactId},source_contact_id.eq.${contactId}`)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("entity_links")
          .select("source_id, deals:source_id(id,title,stage_id,status)")
          .eq("source_type", "deal")
          .eq("target_type", "contact")
          .eq("target_id", contactId)
          .limit(50),
        supabase
          .from("leads")
          .select("id,property_address,status,source_contact_id,created_at")
          .eq("source_contact_id", contactId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("entity_links")
          .select("source_id, leads:source_id(id,property_address,status)")
          .eq("source_type", "lead")
          .eq("target_type", "contact")
          .eq("target_id", contactId)
          .limit(50),
      ]);
      if (!active) return;
      const contactRow = (c as Contact) || null;
      setContact(contactRow);
      setActivities((acts as TimelineActivity[]) || []);
      setPeople((p as Person[]) || []);

      // Merge deals from direct FKs and entity_links, dedupe by id
      const dealMap = new Map<string, { id: string; name: string; stage: string | null; status: string | null }>();
      ((directDeals as any[]) || []).forEach((d) => {
        dealMap.set(d.id, { id: d.id, name: d.title, stage: d.stage_id, status: d.status });
      });
      ((linkedDealRows as any[]) || []).forEach((row) => {
        const d = row.deals;
        if (d && !dealMap.has(d.id)) {
          dealMap.set(d.id, { id: d.id, name: d.title, stage: d.stage_id, status: d.status });
        }
      });
      setLinkedDeals(Array.from(dealMap.values()));

      const leadMap = new Map<string, { id: string; address: string | null; status: string | null }>();
      ((directLeads as any[]) || []).forEach((l) => {
        leadMap.set(l.id, { id: l.id, address: l.property_address, status: l.status });
      });
      ((linkedLeadRows as any[]) || []).forEach((row) => {
        const l = row.leads;
        if (l && !leadMap.has(l.id)) {
          leadMap.set(l.id, { id: l.id, address: l.property_address, status: l.status });
        }
      });
      setLinkedLeads(Array.from(leadMap.values()));

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

  // Load the default pipeline once so we can offer "+ Create new deal" from this sheet.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("pipelines")
        .select("id")
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (active) setDefaultPipelineId((data as any)?.id ?? null);
    })();
    return () => { active = false; };
  }, []);

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

  const refreshLinkedDeals = async () => {
    if (!contactId) return;
    const [{ data: directDeals }, { data: linkedDealRows }] = await Promise.all([
      supabase
        .from("deals")
        .select("id,title,stage_id,status,primary_contact_id,source_contact_id")
        .or(`primary_contact_id.eq.${contactId},source_contact_id.eq.${contactId}`)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("entity_links")
        .select("source_id, deals:source_id(id,title,stage_id,status)")
        .eq("source_type", "deal")
        .eq("target_type", "contact")
        .eq("target_id", contactId)
        .limit(50),
    ]);
    const dealMap = new Map<string, { id: string; name: string; stage: string | null; status: string | null }>();
    ((directDeals as any[]) || []).forEach((d) =>
      dealMap.set(d.id, { id: d.id, name: d.title, stage: d.stage_id, status: d.status }),
    );
    ((linkedDealRows as any[]) || []).forEach((row) => {
      const d = row.deals;
      if (d && !dealMap.has(d.id)) {
        dealMap.set(d.id, { id: d.id, name: d.title, stage: d.stage_id, status: d.status });
      }
    });
    setLinkedDeals(Array.from(dealMap.values()));
  };

  const refreshLinkedLeads = async () => {
    if (!contactId) return;
    const [{ data: directLeads }, { data: linkedLeadRows }] = await Promise.all([
      supabase
        .from("leads")
        .select("id,property_address,status,source_contact_id,created_at")
        .eq("source_contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("entity_links")
        .select("source_id, leads:source_id(id,property_address,status)")
        .eq("source_type", "lead")
        .eq("target_type", "contact")
        .eq("target_id", contactId)
        .limit(50),
    ]);
    const leadMap = new Map<string, { id: string; address: string | null; status: string | null }>();
    ((directLeads as any[]) || []).forEach((l) =>
      leadMap.set(l.id, { id: l.id, address: l.property_address, status: l.status }),
    );
    ((linkedLeadRows as any[]) || []).forEach((row) => {
      const l = row.leads;
      if (l && !leadMap.has(l.id)) {
        leadMap.set(l.id, { id: l.id, address: l.property_address, status: l.status });
      }
    });
    setLinkedLeads(Array.from(leadMap.values()));
  };

  const linkDeal = async (dealId: string) => {
    if (!contact || !user) return;
    const { error } = await supabase.from("entity_links").insert({
      source_type: "deal",
      source_id: dealId,
      target_type: "contact",
      target_id: contact.id,
      created_by: user.id,
    });
    if (error) {
      toast({ title: "Couldn't link deal", description: error.message, variant: "destructive" });
      return;
    }
    await refreshLinkedDeals();
    onChanged();
  };

  const linkLead = async (leadId: string) => {
    if (!contact || !user) return;
    // Leads can be linked via source_contact_id (single) or entity_links (many).
    // Use entity_links to match the multi-contact pattern used by deals.
    const { error } = await supabase.from("entity_links").insert({
      source_type: "lead",
      source_id: leadId,
      target_type: "contact",
      target_id: contact.id,
      created_by: user.id,
    });
    if (error) {
      toast({ title: "Couldn't link lead", description: error.message, variant: "destructive" });
      return;
    }
    await refreshLinkedLeads();
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
          <ContactDetailBody
            contact={contact}
            companyName={companyName}
            linkedDeals={linkedDeals}
            linkedLeads={linkedLeads}
            lastContacted={lastContacted}
            tab={tab}
            setTab={setTab}
            composeOpen={composeOpen}
            composeCtx={composeCtx}
            setComposeOpen={setComposeOpen}
            setComposeCtx={setComposeCtx}
            handleSent={handleSent}
            canEmail={canEmail}
            fullName={fullName}
            typeColor={typeColor}
            typeLabel={typeLabel}
            updateContact={updateContact}
            setContact={setContact}
            setCompanyName={setCompanyName}
            onChanged={onChanged}
            linkDeal={linkDeal}
            linkLead={linkLead}
            onCreateDeal={defaultPipelineId ? () => setCreateDealOpen(true) : undefined}
            onCreateLead={() => setCreateLeadOpen(true)}
            hasCustomFields={hasCustomFields}
          />
        )}
      </EntitySheetShell>

      {contact && defaultPipelineId && (
        <NewDealDialog
          open={createDealOpen}
          onOpenChange={setCreateDealOpen}
          pipelineId={defaultPipelineId}
          workspaceId={contact.workspace_id}
          userId={user?.id ?? null}
          defaultContactId={contact.id}
          onCreated={async () => {
            setCreateDealOpen(false);
            await refreshLinkedDeals();
            onChanged();
          }}
        />
      )}

      {contact && (
        <NewLeadDialog
          open={createLeadOpen}
          onOpenChange={setCreateLeadOpen}
          workspaceId={contact.workspace_id}
          userId={user?.id ?? null}
          defaultContactId={contact.id}
          onCreated={async () => {
            setCreateLeadOpen(false);
            await refreshLinkedLeads();
            onChanged();
          }}
        />
      )}
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
  onCreateDeal,
  onCreateLead,
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
  onCreateDeal?: () => void;
  onCreateLead?: () => void;
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
              onCreate={onCreateDeal}
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
              onCreate={onCreateDeal}
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
              onCreate={onCreateLead}
            />
          ) : undefined
        }
      >
        {leads.length === 0 ? (
          onLinkLead ? (
            <LinkRecordPopover
              kind="lead"
              excludeIds={[]}
              onPick={(it) => onLinkLead(it.id)}
              onCreate={onCreateLead}
              triggerLabel="Link lead"
            />
          ) : (
            <EntityEmpty>No leads linked.</EntityEmpty>
          )
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
  contactType,
  values,
  onSaved,
}: {
  contactId: string;
  contactType: string | null;
  values: Record<string, unknown>;
  onSaved: (v: Record<string, unknown>) => void;
}) {
  const { fields, loading } = useCustomFields("contact", contactType);
  const [draft, setDraft] = useState<Record<string, unknown>>(values);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(values), [contactId]);
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
  if (loading) {
    return <p className="text-xs text-muted-foreground">Loading…</p>;
  }
  if (fields.length === 0) {
    const typeLbl = CONTACT_TYPE_LABEL[(contactType as ContactType) || "other"];
    return (
      <p className="text-xs text-muted-foreground">
        No profile fields for {typeLbl} contacts.{" "}
        <Link to="/settings" className="text-primary hover:underline">
          → Set up in Settings
        </Link>
      </p>
    );
  }
  // Decorate the creative_friendly field with a tooltip on its label
  const decorated = fields.map((f) =>
    f.field_key === "creative_friendly"
      ? {
          ...f,
          label: f.label, // label kept; tooltip rendered separately by wrapper if desired
        }
      : f,
  );
  return (
    <section>
      <CustomFieldsRenderer fields={decorated} values={draft} onChange={setDraft} compact />
      {fields.some((f) => f.field_key === "creative_friendly") && (
        <p className="text-[11px] text-muted-foreground mt-2">
          <span className="font-medium">Creative Friendly:</span> Comfortable with subject-to,
          wraps, seller finance, and creative deal structures.
        </p>
      )}
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

// ───────────────────────────────────────────────────────────────────────
// New "view-first" presentation components
// ───────────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[12px] font-semibold uppercase text-muted-foreground mb-3"
      style={{ letterSpacing: "0.12em" }}
    >
      {children}
    </div>
  );
}

function ContactDetailsBlock({
  contact,
  companyName,
  onChange,
  onCompanyChange,
  onChanged,
}: {
  contact: Contact;
  companyName: string | null;
  onChange: (patch: Partial<Contact>) => void;
  onCompanyChange: (name: string | null) => void;
  onChanged: () => void;
}) {
  const persist = async (patch: Partial<Contact>) => {
    const { error } = await supabase.from("contacts").update(patch as any).eq("id", contact.id);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    onChange(patch);
    onChanged();
  };

  return (
    <section>
      <SectionLabel>Contact details</SectionLabel>
      <div className="-mx-2">
        <EditableLineField
          icon={<Phone className="h-4 w-4" />}
          value={contact.phone}
          placeholder="No phone added"
          type="tel"
          onSave={(v) => persist({ phone: v })}
          ariaLabel="Edit phone"
        />
        <EditableLineField
          icon={<Mail className="h-4 w-4" />}
          value={contact.email}
          placeholder="No email added"
          type="email"
          onSave={(v) => persist({ email: v })}
          ariaLabel="Edit email"
        />
        <CompanyEditableLine
          contact={contact}
          companyName={companyName}
          onPicked={async ({ id, name }) => {
            const { error } = await supabase
              .from("contacts")
              .update({ company_id: id })
              .eq("id", contact.id);
            if (error) {
              toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
              return;
            }
            onChange({ company_id: id });
            onCompanyChange(name);
            onChanged();
          }}
          onClear={async () => {
            const { error } = await supabase
              .from("contacts")
              .update({ company_id: null })
              .eq("id", contact.id);
            if (error) {
              toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
              return;
            }
            onChange({ company_id: null });
            onCompanyChange(null);
            onChanged();
          }}
        />
      </div>
    </section>
  );
}

function ContactNotesBlock({
  contact,
  onSaved,
  onChanged,
}: {
  contact: Contact;
  onSaved: (patch: Partial<Contact>) => void;
  onChanged: () => void;
}) {
  return (
    <section>
      <SectionLabel>Notes</SectionLabel>
      <div className="-mx-2">
        <EditableLineField
          value={contact.buy_box_notes}
          placeholder="Add notes about this contact — deal quality, how they work, what they buy…"
          multiline
          onSave={async (v) => {
            const patch = { buy_box_notes: v };
            const { error } = await supabase
              .from("contacts")
              .update(patch as any)
              .eq("id", contact.id);
            if (error) {
              toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
              return;
            }
            onSaved(patch);
            onChanged();
          }}
          ariaLabel="Edit notes"
        />
      </div>
    </section>
  );
}

function CompanyEditableLine({
  contact,
  companyName,
  onPicked,
  onClear,
}: {
  contact: Contact;
  companyName: string | null;
  onPicked: (c: { id: string; name: string }) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      setLoading(true);
      let q = supabase.from("companies").select("id,name").order("name").limit(25);
      if (query.trim()) q = q.ilike("name", `%${query.trim()}%`);
      const { data } = await q;
      if (!active) return;
      setResults(((data as any[]) || []) as Array<{ id: string; name: string }>);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [open, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group w-full text-left flex items-start gap-3 px-2 py-2 -mx-0 rounded-md transition-colors hover:bg-[hsl(var(--muted)/0.6)]"
          aria-label="Edit company"
        >
          <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <span
            className={cn(
              "flex-1 min-w-0 text-sm",
              companyName ? "text-foreground" : "italic text-muted-foreground/70",
            )}
          >
            {companyName || "No company added"}
          </span>
          <Pencil className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/70 transition-colors shrink-0 mt-1" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search companies…"
              className="h-8 pl-7 text-sm"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-auto py-1">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading…
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-6 text-xs text-muted-foreground text-center">
              No matches.
            </div>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={async () => {
                  await onPicked(c);
                  setOpen(false);
                  setQuery("");
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 truncate"
              >
                {c.name}
              </button>
            ))
          )}
          {contact.company_id && (
            <button
              type="button"
              onClick={async () => {
                await onClear();
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:text-destructive border-t mt-1 pt-2"
            >
              Clear company
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ContactTypeChip({
  value,
  onChange,
}: {
  value: ContactType;
  onChange: (v: ContactType) => void;
}) {
  const [open, setOpen] = useState(false);
  const color = CONTACT_TYPE_COLOR[value];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group inline-flex items-center gap-2 text-sm hover:text-foreground transition-colors -mx-1 px-1 py-0.5 rounded hover:bg-[hsl(var(--muted)/0.6)]"
          aria-label="Change type"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: `hsl(${color})` }}
          />
          <span className="text-foreground">{CONTACT_TYPE_LABEL[value]}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-1">
        {CONTACT_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              onChange(t);
              setOpen(false);
            }}
            className={cn(
              "w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted/60",
              t === value && "bg-muted/40",
            )}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: `hsl(${CONTACT_TYPE_COLOR[t]})` }}
            />
            {CONTACT_TYPE_LABEL[t]}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function PreferredContactChip({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  const iconFor = (m: string | null) => {
    switch (m) {
      case "email":
        return <Mail className="h-3.5 w-3.5" />;
      case "phone":
      case "call":
        return <Phone className="h-3.5 w-3.5" />;
      case "text":
      case "sms":
        return <MessageSquare className="h-3.5 w-3.5" />;
      default:
        return <Smartphone className="h-3.5 w-3.5" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group inline-flex items-center gap-2 text-sm hover:text-foreground transition-colors -mx-1 px-1 py-0.5 rounded hover:bg-[hsl(var(--muted)/0.6)]"
          aria-label="Change preferred contact"
        >
          {value ? (
            <>
              <span className="text-muted-foreground">{iconFor(value)}</span>
              <span className="text-foreground capitalize">Prefers {value}</span>
            </>
          ) : (
            <span className="italic text-muted-foreground/70">Not set</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-1">
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
          className="w-full text-left px-2 py-1.5 rounded text-sm italic text-muted-foreground hover:bg-muted/60"
        >
          Not set
        </button>
        {PREFERRED_CONTACT_METHODS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              onChange(m);
              setOpen(false);
            }}
            className={cn(
              "w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-sm capitalize hover:bg-muted/60",
              m === value && "bg-muted/40",
            )}
          >
            <span className="text-muted-foreground">{iconFor(m)}</span>
            {m}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Attio-style two-column body — left identity sidebar / right tabs
// ═══════════════════════════════════════════════════════════════════════

function ContactDetailBody({
  contact,
  companyName,
  linkedDeals,
  linkedLeads,
  lastContacted,
  tab,
  setTab,
  composeOpen,
  composeCtx,
  setComposeOpen,
  setComposeCtx,
  handleSent,
  canEmail,
  fullName,
  typeColor,
  typeLabel,
  updateContact,
  setContact,
  setCompanyName,
  onChanged,
  linkDeal,
  linkLead,
  onCreateDeal,
  onCreateLead,
  hasCustomFields,
}: {
  contact: Contact;
  companyName: string | null;
  linkedDeals: Array<{ id: string; name: string; stage: string | null; status: string | null }>;
  linkedLeads: Array<{ id: string; address: string | null; status: string | null }>;
  lastContacted: string | null;
  tab: EntityTabId;
  setTab: (v: EntityTabId) => void;
  composeOpen: boolean;
  composeCtx: { to: string; subject: string; threadId?: string };
  setComposeOpen: (v: boolean) => void;
  setComposeCtx: (v: { to: string; subject: string; threadId?: string }) => void;
  handleSent: (r: { threadId?: string; id?: string }) => void;
  canEmail: boolean;
  fullName: string;
  typeColor: string;
  typeLabel: string;
  updateContact: (patch: Partial<Contact>) => Promise<void>;
  setContact: (c: Contact) => void;
  setCompanyName: (name: string | null) => void;
  onChanged: () => void;
  linkDeal: (dealId: string) => Promise<void>;
  linkLead: (leadId: string) => Promise<void>;
  onCreateDeal?: () => void;
  onCreateLead?: () => void;
  hasCustomFields: boolean;
}) {
  const initials =
    `${contact.first_name?.[0] ?? ""}${contact.last_name?.[0] ?? ""}`.toUpperCase() ||
    "?";
  const isActive = contact.is_active !== false;
  const persist = async (patch: Partial<Contact>) => {
    const { error } = await supabase.from("contacts").update(patch as any).eq("id", contact.id);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    setContact({ ...contact, ...patch });
    onChanged();
  };

  const tabs: Array<{ id: EntityTabId; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "activity", label: "Activity" },
    { id: "deals", label: "Deals" },
    { id: "files", label: "Files" },
  ];

  return (
    <div className="flex-1 grid grid-cols-1 md:grid-cols-[360px_minmax(0,1fr)] min-h-0 overflow-hidden">
      {/* ─────────────── LEFT: Identity sidebar ─────────────── */}
      <aside
        className="overflow-auto bg-background border-r"
        style={{ borderRightColor: "#F0F0F0" }}
      >
        <div className="p-6 space-y-5">
          {/* Identity */}
          <div className="space-y-3">
            <div
              className="h-20 w-20 rounded-full flex items-center justify-center text-white font-semibold text-2xl"
              style={{ backgroundColor: `hsl(${typeColor})` }}
              aria-label="Contact avatar"
            >
              {initials}
            </div>
            <div className="space-y-1.5">
              <h2 className="text-[22px] font-semibold leading-tight text-foreground break-words">
                {fullName}
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <ContactTypeChip
                  value={(contact.contact_type as ContactType) || "other"}
                  onChange={(v) => updateContact({ contact_type: v })}
                />
                {companyName && (
                  <>
                    <span className="text-muted-foreground/50 text-xs">·</span>
                    <span className="text-[13px] text-muted-foreground truncate">{companyName}</span>
                  </>
                )}
              </div>
              <div className="text-[12px] italic text-muted-foreground/70">
                {lastContacted ? `Last contacted ${lastContacted}` : "Never contacted"}
              </div>
            </div>
          </div>

          {/* Action row */}
          <div className="flex items-center gap-1.5">
            <ActionPill
              icon={<Mail className="h-3.5 w-3.5" />}
              label="Email"
              disabled={!canEmail}
              onClick={() => {
                setComposeCtx({ to: contact.email!, subject: "" });
                setComposeOpen(true);
              }}
            />
            <ActionPill
              icon={<Phone className="h-3.5 w-3.5" />}
              label="Call"
              disabled={!contact.phone}
              onClick={() => {
                if (contact.phone) window.location.href = `tel:${contact.phone}`;
              }}
            />
            <ActionPill
              icon={<Pencil className="h-3.5 w-3.5" />}
              label="Note"
              onClick={() => setTab("activity")}
            />
            <ActionPill
              icon={<MoreHorizontal className="h-3.5 w-3.5" />}
              label=""
              ariaLabel="More"
              onClick={() => {}}
            />
          </div>

          <SidebarDivider />

          {/* Contact details */}
          <SidebarBlock label="Contact details">
            <SidebarRow icon={<Phone className="h-4 w-4" />}>
              <EditableLineField
                value={contact.phone}
                placeholder="Add phone"
                type="tel"
                onSave={(v) => persist({ phone: v })}
                ariaLabel="Edit phone"
                className="!py-0 !px-0 !-mx-0"
              />
            </SidebarRow>
            <SidebarRow icon={<Mail className="h-4 w-4" />}>
              <EditableLineField
                value={contact.email}
                placeholder="Add email"
                type="email"
                onSave={(v) => persist({ email: v })}
                ariaLabel="Edit email"
                className="!py-0 !px-0 !-mx-0"
              />
            </SidebarRow>
            <SidebarRow icon={<Building2 className="h-4 w-4" />}>
              <CompanyEditableLine
                contact={contact}
                companyName={companyName}
                onPicked={async ({ id, name }) => {
                  const { error } = await supabase
                    .from("contacts")
                    .update({ company_id: id })
                    .eq("id", contact.id);
                  if (error) {
                    toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
                    return;
                  }
                  setContact({ ...contact, company_id: id });
                  setCompanyName(name);
                  onChanged();
                }}
                onClear={async () => {
                  const { error } = await supabase
                    .from("contacts")
                    .update({ company_id: null })
                    .eq("id", contact.id);
                  if (error) {
                    toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
                    return;
                  }
                  setContact({ ...contact, company_id: null });
                  setCompanyName(null);
                  onChanged();
                }}
              />
            </SidebarRow>
            <SidebarRow icon={<MapPin className="h-4 w-4" />} align="start">
              <ContactMarketsInline
                contact={contact}
                onSaved={(patch) => setContact({ ...contact, ...patch })}
                onChanged={onChanged}
              />
            </SidebarRow>
            <SidebarRow icon={<MessageSquare className="h-4 w-4" />}>
              <PreferredContactChip
                value={contact.preferred_contact_method || null}
                onChange={(v) =>
                  updateContact({
                    preferred_contact_method: v as PreferredContactMethod | null,
                  })
                }
              />
            </SidebarRow>
            <SidebarRow
              icon={
                <span
                  className={cn(
                    "h-2 w-2 rounded-full inline-block",
                    isActive ? "bg-brand-mint-deep" : "bg-muted-foreground/40",
                  )}
                />
              }
            >
              <button
                type="button"
                onClick={() => updateContact({ is_active: !isActive })}
                className="text-sm hover:text-foreground transition-colors"
              >
                <span className={isActive ? "text-foreground" : "text-muted-foreground"}>
                  {isActive ? "Active" : "Inactive"}
                </span>
              </button>
            </SidebarRow>
          </SidebarBlock>

          <SidebarDivider />

          {/* Relationship notes */}
          <SidebarBlock label="Relationship">
            <Textarea
              defaultValue={contact.buy_box_notes || ""}
              onBlur={(e) => {
                const next = e.target.value.trim() || null;
                if ((next || "") !== (contact.buy_box_notes || "")) {
                  void persist({ buy_box_notes: next });
                }
              }}
              placeholder="Deal quality, what they buy, how they work…"
              rows={4}
              className="text-sm resize-none border-border/60"
            />
          </SidebarBlock>

          <SidebarDivider />

          {/* Owner */}
          <SidebarBlock label="Owner">
            <OwnerPicker
              ownerId={contact.owner_id}
              onChange={(id) => updateContact({ owner_id: id })}
            />
          </SidebarBlock>

          <SidebarDivider />

          {/* Linked records */}
          <SidebarBlock label="Linked records">
            <LinkedRecordsRow
              kind="deal"
              count={linkedDeals.length}
              items={linkedDeals.map((d) => ({ id: d.id, label: d.name }))}
              icon={<Briefcase className="h-3.5 w-3.5" />}
              emptyLabel="No deals yet"
              excludeIds={linkedDeals.map((d) => d.id)}
              onPick={(it) => linkDeal(it.id)}
              onCreate={onCreateDeal}
            />
            <LinkedRecordsRow
              kind="lead"
              count={linkedLeads.length}
              items={linkedLeads.map((l) => ({ id: l.id, label: l.address || "Untitled lead" }))}
              icon={<Sparkles className="h-3.5 w-3.5" />}
              emptyLabel="No leads yet"
              excludeIds={linkedLeads.map((l) => l.id)}
              onPick={(it) => linkLead(it.id)}
              onCreate={onCreateLead}
            />
          </SidebarBlock>

          {/* Meta — small muted footer with the date added and source */}
          <div className="pt-2 flex items-end justify-end">
            <div className="text-right text-[11px] text-muted-foreground/70 leading-snug space-y-0.5">
              {contact.created_at && (
                <div>
                  Added {new Date(contact.created_at).toLocaleDateString()}
                </div>
              )}
              {contact.source && (
                <div className="capitalize">via {contact.source}</div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ─────────────── RIGHT: Tabs + content ─────────────── */}
      <div className="flex flex-col min-h-0 bg-[#F8F8F8] dark:bg-muted/10">
        {composeOpen ? (
          <InlineEmailComposer
            defaultTo={composeCtx.to}
            defaultSubject={composeCtx.subject}
            threadId={composeCtx.threadId}
            onClose={() => setComposeOpen(false)}
            onSent={handleSent}
          />
        ) : (
          <EntityTabs value={tab} onValueChange={setTab} tabs={tabs} className="bg-background">
            <EntityTabPanel value="overview" className="p-6">
              <div className="space-y-6 max-w-3xl">
                <OverviewCard title="About">
                  <p
                    className={cn(
                      "text-sm whitespace-pre-wrap",
                      contact.notes
                        ? "text-foreground"
                        : "italic text-muted-foreground/70",
                    )}
                  >
                    {contact.notes || "No notes yet."}
                  </p>
                </OverviewCard>
                <OverviewCard title="Profile">
                  <CustomFieldsPanel
                    contactId={contact.id}
                    contactType={contact.contact_type}
                    values={(contact.custom_fields || {}) as Record<string, unknown>}
                    onSaved={(v) => setContact({ ...contact, custom_fields: v })}
                  />
                </OverviewCard>
              </div>
            </EntityTabPanel>

            <EntityTabPanel value="activity" className="p-6 overflow-hidden">
              <div
                className="h-full flex flex-col bg-card rounded-xl overflow-hidden max-w-3xl"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
              >
                <div className="flex-1 min-h-0 flex flex-col p-5">
                  <ActivityPanel
                    entityType="contact"
                    entityId={contact.id}
                    hideHeader
                    onReplyEmail={({ threadId, subject }) => {
                      setComposeCtx({
                        to: contact.email || "",
                        subject: subject?.toLowerCase().startsWith("re:") ? subject : `Re: ${subject || ""}`.trim(),
                        threadId,
                      });
                      setComposeOpen(true);
                    }}
                  />
                </div>
              </div>
            </EntityTabPanel>

            <EntityTabPanel value="deals" className="p-6">
              <div className="max-w-3xl">
                {linkedDeals.length === 0 ? (
                  <div className="rounded-xl bg-card flex flex-col items-center justify-center py-16 text-center text-sm text-muted-foreground" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                    <Briefcase className="h-8 w-8 mb-2 opacity-50" />
                    <p className="font-medium text-foreground mb-1">No deals sourced yet</p>
                    <p>Deals sourced from this contact will appear here.</p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-card overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                    <ul className="divide-y divide-border/40">
                      {linkedDeals.map((d) => (
                        <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#F9F9F9] transition-colors">
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
                  </div>
                )}
              </div>
            </EntityTabPanel>

            <EntityTabPanel value="files" className="p-6">
              <div className="max-w-3xl rounded-xl bg-card flex flex-col items-center justify-center py-16 text-center text-sm text-muted-foreground" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <Inbox className="h-8 w-8 mb-2 opacity-50" />
                <p className="font-medium text-foreground mb-1">No files yet</p>
                <p>File attachments for contacts will appear here.</p>
              </div>
            </EntityTabPanel>
          </EntityTabs>
        )}
      </div>
    </div>
  );
}

function ActionPill({
  icon,
  label,
  onClick,
  disabled,
  ariaLabel,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-muted/60 hover:bg-muted text-foreground px-3 py-1.5 text-xs font-medium transition-colors",
        "disabled:opacity-40 disabled:cursor-not-allowed",
      )}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}

function SidebarBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div
        className="text-[11px] font-semibold uppercase text-muted-foreground"
        style={{ letterSpacing: "0.14em" }}
      >
        {label}
      </div>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function SidebarDivider() {
  return <div className="h-px bg-[#F0F0F0]" />;
}

function SidebarRow({
  icon,
  children,
  align = "center",
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  align?: "center" | "start";
}) {
  return (
    <div className={cn("flex gap-2.5 min-w-0", align === "start" ? "items-start" : "items-center")}>
      <span className={cn("text-muted-foreground shrink-0", align === "start" ? "mt-1.5" : "")}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function KeyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] uppercase text-muted-foreground" style={{ letterSpacing: "0.12em" }}>
        {label}
      </span>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function ContactMarketsInline({
  contact,
  onSaved,
  onChanged,
}: {
  contact: Contact;
  onSaved: (patch: Partial<Contact>) => void;
  onChanged: () => void;
}) {
  const [markets, setMarkets] = useState<string[]>(contact.markets || []);
  const [draft, setDraft] = useState("");
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

  const add = () => {
    const v = draft.trim();
    setDraft("");
    setAdding(false);
    if (!v || markets.includes(v)) return;
    const next = [...markets, v];
    setMarkets(next);
    void persist(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {markets.length === 0 && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-sm italic text-muted-foreground/70 hover:text-foreground"
        >
          Add markets
        </button>
      )}
      {markets.map((m) => (
        <span
          key={m}
          className="inline-flex items-center gap-1 rounded-full bg-brand-azure/15 text-brand-azure font-semibold"
          style={{ borderRadius: 100, padding: "3px 10px", fontSize: 11 }}
        >
          {m}
          <button
            type="button"
            onClick={() => {
              const next = markets.filter((x) => x !== m);
              setMarkets(next);
              void persist(next);
            }}
            className="opacity-60 hover:opacity-100"
            aria-label={`Remove ${m}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {adding ? (
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={add}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            } else if (e.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
          placeholder="Market"
          className="h-6 text-xs w-24"
        />
      ) : markets.length > 0 ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-[11px] font-medium text-muted-foreground hover:text-foreground px-1.5"
        >
          + Add
        </button>
      ) : null}
    </div>
  );
}

function LinkedRecordsRow({
  kind,
  count,
  items,
  icon,
  emptyLabel,
  excludeIds,
  onPick,
  onCreate,
}: {
  kind: "deal" | "lead";
  count: number;
  items: Array<{ id: string; label: string }>;
  icon: React.ReactNode;
  emptyLabel: string;
  excludeIds: string[];
  onPick: (it: { id: string; label: string }) => void | Promise<void>;
  onCreate?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const noun = kind === "deal" ? "Deals" : "Leads";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => count > 0 && setExpanded((e) => !e)}
          disabled={count === 0}
          className={cn(
            "inline-flex items-center gap-2 text-sm",
            count > 0 ? "hover:text-foreground" : "text-muted-foreground cursor-default",
          )}
        >
          <span className="text-muted-foreground">{icon}</span>
          {count === 0 ? (
            <span className="italic text-muted-foreground/70">{emptyLabel}</span>
          ) : (
            <span className="font-medium">
              {count} {count === 1 ? noun.slice(0, -1) : noun}
            </span>
          )}
        </button>
        <LinkRecordPopover
          kind={kind}
          excludeIds={excludeIds}
          onPick={onPick}
          onCreate={onCreate}
          triggerLabel={`Link ${kind}`}
        />
      </div>
      {expanded && items.length > 0 && (
        <ul className="pl-6 space-y-0.5">
          {items.map((it) => (
            <li
              key={it.id}
              className="text-[13px] text-foreground truncate py-0.5"
              title={it.label}
            >
              {it.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OverviewCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-xl bg-card p-5"
      style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
    >
      <h3
        className="text-[11px] font-semibold uppercase text-muted-foreground mb-3"
        style={{ letterSpacing: "0.14em" }}
      >
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function KVRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className="text-[11px] uppercase text-muted-foreground shrink-0"
        style={{ letterSpacing: "0.12em" }}
      >
        {label}
      </span>
      <span className="text-sm text-foreground text-right min-w-0 truncate">
        {value || <span className="italic text-muted-foreground/70">—</span>}
      </span>
    </div>
  );
}
