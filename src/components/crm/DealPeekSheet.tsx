import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Mail, Phone, Briefcase, NotebookPen, ExternalLink, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { CustomFieldsRenderer, useCustomFields } from "./CustomFieldsRenderer";

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
  status: string;
  lost_reason: string | null;
  description: string;
  custom_fields: Record<string, unknown>;
}
interface Stage { id: string; name: string; color: string; is_won: boolean; is_lost: boolean }
interface ContactLite { id: string; first_name: string; last_name: string; email: string | null; phone: string | null }
interface Activity { id: string; type: string; subject: string; body: string; occurred_at: string; metadata?: Record<string, unknown> }

const formatMoney = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

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
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [editClose, setEditClose] = useState("");

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
        const [{ data: st }, { data: links }, { data: acts }] = await Promise.all([
          supabase.from("pipeline_stages").select("id,name,color,is_won,is_lost").eq("pipeline_id", dealRow.pipeline_id).order("sort_order"),
          supabase.from("entity_links").select("target_id").eq("source_type", "deal").eq("source_id", dealRow.id).eq("target_type", "contact"),
          supabase.from("crm_activities").select("id,type,subject,body,occurred_at,metadata").eq("entity_type", "deal").eq("entity_id", dealRow.id).order("occurred_at", { ascending: false }).limit(50),
        ]);
        if (!active) return;
        setStages((st as Stage[]) || []);
        setActivities((acts as Activity[]) || []);
        const ids = ((links as { target_id: string }[]) || []).map((l) => l.target_id);
        if (dealRow.primary_contact_id) ids.unshift(dealRow.primary_contact_id);
        const uniq = Array.from(new Set(ids));
        if (uniq.length) {
          const { data: cs } = await supabase.from("contacts").select("id,first_name,last_name,email,phone").in("id", uniq);
          setContacts((cs as ContactLite[]) || []);
        } else {
          setContacts([]);
        }
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [dealId]);

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

  const isOpen = !!dealId;
  const currentStage = stages.find((s) => s.id === deal?.stage_id);

  return (
    <Sheet open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        {loading || !deal ? (
          <div className="flex items-center justify-center h-full text-muted-foreground gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50">
              <SheetTitle className="text-xl flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                {deal.title}
              </SheetTitle>
              <div className="flex items-center gap-2 flex-wrap pt-1">
                {currentStage && (
                  <Badge variant="outline" className="text-[10px]" style={{ borderColor: `hsl(${currentStage.color})`, color: `hsl(${currentStage.color})` }}>
                    {currentStage.name}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px] capitalize">{deal.status}</Badge>
                <span className="text-sm font-medium ml-1">{formatMoney(Number(deal.value || 0), deal.currency)}</span>
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
                    {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                {deal.status === "lost" && (
                  <div className="col-span-2">
                    <Label className="text-xs">Lost reason</Label>
                    <Input
                      defaultValue={deal.lost_reason ?? ""}
                      onBlur={(e) => { if (e.target.value !== (deal.lost_reason ?? "")) saveField({ lost_reason: e.target.value }); }}
                    />
                  </div>
                )}
              </div>

              {/* Linked contacts */}
              <div className="px-6 py-4 border-b border-border/50">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Linked contacts</div>
                {contacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No contacts linked yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {contacts.map((c) => {
                      const name = `${c.first_name} ${c.last_name}`.trim() || c.email || "Untitled";
                      return (
                        <div key={c.id} className="flex items-center justify-between text-sm rounded-md border border-border/40 px-2 py-1.5">
                          <span className="font-medium truncate">{name}</span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {c.email && <a href={`mailto:${c.email}`} className="hover:text-primary inline-flex items-center gap-1"><Mail className="h-3 w-3" />Email</a>}
                            {c.phone && <a href={`tel:${c.phone}`} className="hover:text-primary inline-flex items-center gap-1"><Phone className="h-3 w-3" />Call</a>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Note */}
              <div className="px-6 py-4 border-b border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <NotebookPen className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Log a note</span>
                </div>
                <Textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={3} placeholder="Update on this deal…" className="text-sm" />
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
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">Activity</div>
                {activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No activity yet.</p>
                ) : (
                  <div className="space-y-3">
                    {activities.map((a) => {
                      const threadId = (a.metadata as any)?.gmail_thread_id as string | undefined;
                      const isEmail = a.type === "email" && threadId;
                      return (
                        <div key={a.id} className="rounded-lg border border-border/40 bg-card p-3 text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] uppercase tracking-wide text-muted-foreground capitalize">{a.type}</span>
                            <div className="flex items-center gap-2">
                              {isEmail && (
                                <Link to={`/inbox?thread=${threadId}`} className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5">
                                  Open <ExternalLink className="h-3 w-3" />
                                </Link>
                              )}
                              <span className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(a.occurred_at), { addSuffix: true })}</span>
                            </div>
                          </div>
                          {a.subject && <div className="font-medium mb-0.5">{a.subject}</div>}
                          {a.body && <p className="whitespace-pre-wrap text-muted-foreground">{a.body}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-border/50 flex justify-end">
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={handleDelete}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete deal
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
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
