import { useEffect, useState } from "react";
import { Loader2, Mail, Phone, Send, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { ComposeModal } from "@/components/inbox/ComposeModal";
import { OwnerPicker } from "./PeoplePickers";
import { CrmComposerTabs, type ComposerSubmit } from "./CrmComposerTabs";
import {
  CrmActivityTimeline,
  ActivityFilterPills,
  type TimelineActivity,
} from "./CrmActivityTimeline";
import {
  CONTACT_TYPES,
  CONTACT_TYPE_LABEL,
  PREFERRED_CONTACT_METHODS,
  contactTypeColor,
  contactTypeLabel,
  type ContactType,
  type PreferredContactMethod,
} from "./contactTypes";

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

const STATUS_COLOR: Record<string, string> = {
  lead: "210 70% 50%",
  active: "142 76% 36%",
  customer: "262 70% 55%",
  lost: "0 70% 50%",
};

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
  const [filter, setFilter] = useState("all");

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
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      const [{ data: c }, { data: acts }, { data: p }] = await Promise.all([
        supabase.from("contacts").select("*").eq("id", contactId).maybeSingle(),
        supabase
          .from("crm_activities")
          .select("id,type,subject,body,occurred_at,actor_id,metadata")
          .eq("entity_type", "contact")
          .eq("entity_id", contactId)
          .order("occurred_at", { ascending: false })
          .limit(200),
        supabase.from("profiles").select("user_id,full_name,avatar_url").limit(500),
      ]);
      if (!active) return;
      setContact((c as Contact) || null);
      setActivities((acts as TimelineActivity[]) || []);
      setPeople((p as Person[]) || []);
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

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-4xl p-0 flex flex-col">
          {loading || !contact ? (
            <div className="flex items-center justify-center h-full text-muted-foreground gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <SheetTitle className="text-xl truncate">
                      {`${contact.first_name} ${contact.last_name}`.trim() || "Untitled contact"}
                    </SheetTitle>
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <Badge
                        className="text-[10px] border-transparent"
                        style={{
                          backgroundColor: `hsl(${contactTypeColor(contact.contact_type)} / 0.15)`,
                          color: `hsl(${contactTypeColor(contact.contact_type)})`,
                        }}
                      >
                        {contactTypeLabel(contact.contact_type)}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] capitalize"
                        style={{
                          borderColor: `hsl(${STATUS_COLOR[contact.status] || "220 12% 60%"})`,
                          color: `hsl(${STATUS_COLOR[contact.status] || "220 12% 60%"})`,
                        }}
                      >
                        {contact.status}
                      </Badge>
                      {contact.is_active === false && (
                        <Badge variant="outline" className="text-[10px]">
                          Inactive
                        </Badge>
                      )}
                      {contact.title && (
                        <span className="text-xs text-muted-foreground">{contact.title}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={!canEmail}
                    onClick={() => openCompose({ to: contact.email!, subject: "" })}
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" /> New email
                  </Button>
                </div>
              </SheetHeader>

              <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_280px] min-h-0 overflow-hidden">
                {/* Main column */}
                <div className="overflow-auto">
                  {/* Composer */}
                  <div className="p-4">
                    <CrmComposerTabs
                      onSubmit={handleComposerSubmit}
                      onSendEmail={() => openCompose({ to: contact.email!, subject: "" })}
                      emailDisabled={!canEmail}
                    />
                  </div>

                  {/* Filter pills + timeline */}
                  <div className="px-4">
                    <ActivityFilterPills
                      activities={activities}
                      value={filter}
                      onChange={setFilter}
                    />
                  </div>
                  <CrmActivityTimeline
                    activities={activities}
                    people={people}
                    filter={filter}
                    onReply={(a) => {
                      const meta = a.metadata as any;
                      openCompose({
                        to: contact.email!,
                        subject: a.subject?.toLowerCase().startsWith("re:")
                          ? a.subject
                          : `Re: ${a.subject || ""}`,
                        threadId: meta?.gmail_thread_id,
                      });
                    }}
                  />
                </div>

                {/* Right rail */}
                <aside className="border-l border-border/50 overflow-auto bg-muted/10">
                  <div className="p-4 space-y-5">
                    {/* Contact info */}
                    <section className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Contact info
                      </div>
                      {contact.email && (
                        <a
                          href={`mailto:${contact.email}`}
                          className="flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          <span className="truncate">{contact.email}</span>
                        </a>
                      )}
                      {contact.phone && (
                        <a
                          href={`tel:${contact.phone}`}
                          className="flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {contact.phone}
                        </a>
                      )}
                      {contact.last_contacted_at && (
                        <div className="text-[11px] text-muted-foreground">
                          Last contacted{" "}
                          {formatDistanceToNow(new Date(contact.last_contacted_at), {
                            addSuffix: true,
                          })}
                        </div>
                      )}
                    </section>

                    {/* Details (type / preferred method / buy box / markets / active) */}
                    <ContactDetailsPanel
                      contact={contact}
                      onSaved={(patch) => setContact({ ...contact, ...patch })}
                      onChanged={onChanged}
                    />

                    {/* Owner */}
                    <section>
                      <OwnerPicker
                        ownerId={contact.owner_id}
                        onChange={async (id) => {
                          const { error } = await supabase
                            .from("contacts")
                            .update({ owner_id: id })
                            .eq("id", contact.id);
                          if (error) {
                            toast({
                              title: "Couldn't update owner",
                              description: error.message,
                              variant: "destructive",
                            });
                            return;
                          }
                          setContact({ ...contact, owner_id: id });
                          onChanged();
                        }}
                      />
                    </section>

                    {/* Custom fields */}
                    <CustomFieldsPanel
                      contactId={contact.id}
                      values={(contact.custom_fields || {}) as Record<string, unknown>}
                      onSaved={(v) => setContact({ ...contact, custom_fields: v })}
                    />

                    {/* Appointments */}
                    <section>
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Appointments
                      </div>
                      {(() => {
                        const upcoming = activities.filter(
                          (a) => a.type === "meeting" && new Date(a.occurred_at) >= new Date(),
                        );
                        if (upcoming.length === 0) {
                          return (
                            <p className="text-xs text-muted-foreground">No upcoming meetings.</p>
                          );
                        }
                        return (
                          <ul className="space-y-1.5">
                            {upcoming.slice(0, 5).map((m) => (
                              <li key={m.id} className="text-xs">
                                <div className="font-medium">{m.subject || "Meeting"}</div>
                                <div className="text-muted-foreground">
                                  {new Date(m.occurred_at).toLocaleString()}
                                </div>
                              </li>
                            ))}
                          </ul>
                        );
                      })()}
                    </section>
                  </div>
                </aside>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ComposeModal
        open={composeOpen}
        onOpenChange={setComposeOpen}
        defaultTo={composeCtx.to}
        defaultSubject={composeCtx.subject}
        threadId={composeCtx.threadId}
        onSent={handleSent}
      />
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
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
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
    </section>
  );
}
