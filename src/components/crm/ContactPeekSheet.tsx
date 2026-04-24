import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Mail, Phone, NotebookPen, ExternalLink, Reply, Send } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { CustomFieldsRenderer, useCustomFields } from "./CustomFieldsRenderer";
import { ComposeModal } from "@/components/inbox/ComposeModal";
import { OwnerPicker } from "./PeoplePickers";

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
}

interface Activity {
  id: string;
  type: string;
  subject: string;
  body: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
}

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
  const [activities, setActivities] = useState<Activity[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Compose modal state
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeCtx, setComposeCtx] = useState<{
    to: string;
    subject: string;
    threadId?: string;
  }>({ to: "", subject: "" });

  const reload = async () => {
    if (!contactId) return;
    const { data: acts } = await supabase
      .from("crm_activities")
      .select("id,type,subject,body,occurred_at,metadata")
      .eq("entity_type", "contact")
      .eq("entity_id", contactId)
      .order("occurred_at", { ascending: false })
      .limit(100);
    setActivities((acts as Activity[]) || []);
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
      const [{ data: c }, { data: acts }] = await Promise.all([
        supabase.from("contacts").select("*").eq("id", contactId).maybeSingle(),
        supabase
          .from("crm_activities")
          .select("id,type,subject,body,occurred_at,metadata")
          .eq("entity_type", "contact")
          .eq("entity_id", contactId)
          .order("occurred_at", { ascending: false })
          .limit(100),
      ]);
      if (!active) return;
      setContact((c as Contact) || null);
      setActivities((acts as Activity[]) || []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [contactId]);

  const logNote = async () => {
    if (!contact || !noteDraft.trim() || !user) return;
    setSavingNote(true);
    const { data, error } = await supabase
      .from("crm_activities")
      .insert({
        workspace_id: contact.workspace_id,
        entity_type: "contact",
        entity_id: contact.id,
        type: "note",
        subject: "",
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
    onChanged();
  };

  const openCompose = (opts: { to: string; subject: string; threadId?: string }) => {
    setComposeCtx(opts);
    setComposeOpen(true);
  };

  const handleSent = async (result: { threadId?: string; id?: string }) => {
    // Link the (new or existing) thread to this contact so it appears in the timeline
    if (!contact || !user || !result.threadId) {
      void reload();
      return;
    }
    // Avoid duplicates if it's a reply to an already-linked thread
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
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
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
                        variant="outline"
                        className="text-[10px] capitalize"
                        style={{
                          borderColor: `hsl(${STATUS_COLOR[contact.status] || "220 12% 60%"})`,
                          color: `hsl(${STATUS_COLOR[contact.status] || "220 12% 60%"})`,
                        }}
                      >
                        {contact.status}
                      </Badge>
                      {contact.title && (
                        <span className="text-xs text-muted-foreground">{contact.title}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={!canEmail}
                    onClick={() =>
                      openCompose({
                        to: contact.email!,
                        subject: "",
                      })
                    }
                    title={canEmail ? "Email this contact" : "No email on file"}
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" /> New email
                  </Button>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-auto">
                {/* Quick info */}
                <div className="px-6 py-4 space-y-2 text-sm border-b border-border/50">
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {contact.email}
                    </a>
                  )}
                  {contact.phone && (
                    <a
                      href={`tel:${contact.phone}`}
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {contact.phone}
                    </a>
                  )}
                  {contact.last_contacted_at && (
                    <div className="text-xs text-muted-foreground pt-1">
                      Last contacted{" "}
                      {formatDistanceToNow(new Date(contact.last_contacted_at), { addSuffix: true })}
                    </div>
                  )}
                </div>

                {/* Owner */}
                <div className="px-6 py-4 border-b border-border/50">
                  <OwnerPicker
                    ownerId={contact.owner_id}
                    onChange={async (id) => {
                      const { error } = await supabase
                        .from("contacts")
                        .update({ owner_id: id })
                        .eq("id", contact.id);
                      if (error) {
                        toast({ title: "Couldn't update owner", description: error.message, variant: "destructive" });
                        return;
                      }
                      setContact({ ...contact, owner_id: id });
                      onChanged();
                    }}
                  />
                </div>

                  contactId={contact.id}
                  values={(contact.custom_fields || {}) as Record<string, unknown>}
                  onSaved={(v) => setContact({ ...contact, custom_fields: v })}
                />

                {/* Log a note */}
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
                    placeholder="What happened? (call summary, meeting notes…)"
                    rows={3}
                    className="text-sm"
                  />
                  <div className="flex justify-end mt-2">
                    <Button size="sm" onClick={logNote} disabled={savingNote || !noteDraft.trim()}>
                      {savingNote && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      Save note
                    </Button>
                  </div>
                </div>

                {/* Activity timeline */}
                <div className="px-6 py-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
                    Activity
                  </div>
                  {activities.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      No activity yet. Log a note above or send an email to get started.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {activities.map((a) => {
                        const meta = a.metadata as any;
                        const threadId = meta?.gmail_thread_id as string | undefined;
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
                                {isEmail && contact.email && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-[11px]"
                                    onClick={() =>
                                      openCompose({
                                        to: contact.email!,
                                        subject: a.subject?.toLowerCase().startsWith("re:")
                                          ? a.subject
                                          : `Re: ${a.subject || ""}`,
                                        threadId,
                                      })
                                    }
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
                                  {formatDistanceToNow(new Date(a.occurred_at), { addSuffix: true })}
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
