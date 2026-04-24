import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Mail, Phone, Building2, NotebookPen, ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

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
  last_contacted_at: string | null;
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

  const isOpen = !!contactId;

  return (
    <Sheet open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        {loading || !contact ? (
          <div className="flex items-center justify-center h-full text-muted-foreground gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50">
              <SheetTitle className="text-xl">
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
                    Last contacted {formatDistanceToNow(new Date(contact.last_contacted_at), { addSuffix: true })}
                  </div>
                )}
              </div>

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
                    {activities.map((a) => (
                      <div key={a.id} className="rounded-lg border border-border/40 bg-card p-3 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground capitalize">
                            {a.type}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(a.occurred_at), { addSuffix: true })}
                          </span>
                        </div>
                        {a.subject && <div className="font-medium mb-0.5">{a.subject}</div>}
                        {a.body && <p className="whitespace-pre-wrap text-muted-foreground">{a.body}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
