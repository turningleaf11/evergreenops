import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  X,
  ChevronUp,
  ChevronDown,
  Mail,
  Phone,
  Building2,
  Archive,
  ArrowRight,
  Send,
  MoreHorizontal,
  NotebookPen,
  Users,
  CheckCircle2,
  Clock,
  Calendar as CalendarIcon,
  Paperclip,
  Home,
  MapPin,
} from "lucide-react";
import { format } from "date-fns";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { cn } from "@/lib/utils";
import { OwnerPicker } from "./PeoplePickers";
import { TEMPERATURE_META, FollowUpPicker } from "./FollowUpPicker";
import {
  CrmActivityTimeline,
  type TimelineActivity,
} from "./CrmActivityTimeline";
import { ComposeModal } from "@/components/inbox/ComposeModal";
import { DocChecklist } from "./DocChecklist";
import { BuyBoxButtons, BUY_BOX_META, type BuyBoxFit } from "./BuyBoxButtons";
import { LeadFilesTab } from "./LeadFilesTab";
import ActivityPanel from "@/components/activity/ActivityPanel";
import { ContactPicker } from "./ContactPicker";

export interface Lead {
  id: string;
  workspace_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  title: string | null;
  source: string | null;
  temperature: string;
  status: string;
  next_action_at: string | null;
  notes: string;
  owner_id: string | null;
  created_at: string;
  buy_box_fit?: string | null;
  disqualification_reason?: string | null;
  has_om?: boolean;
  has_t12?: boolean;
  has_rent_roll?: boolean;
  source_contact_id?: string | null;
  property_address?: string | null;
  property_city?: string | null;
  property_state?: string | null;
  property_zip?: string | null;
  property_type?: string | null;
  units?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  asking_price?: number | null;
  listed_cap_rate?: number | null;
  gross_income?: number | null;
  noi?: number | null;
  converted_deal_id?: string | null;
}

interface PersonLite {
  user_id: string;
  full_name: string | null;
  avatar_url?: string | null;
}

// temperature labels removed from peek; field still exists in schema
const PLAN_TYPES = [
  { value: "call", label: "Call", icon: Phone },
  { value: "meeting", label: "Meeting", icon: Users },
  { value: "task", label: "Task", icon: CheckCircle2 },
  { value: "email", label: "Email", icon: Mail },
];

function presetDate(kind: "in_1h" | "in_3h" | "tomorrow" | "next_week"): Date {
  const d = new Date();
  switch (kind) {
    case "in_1h":
      d.setHours(d.getHours() + 1);
      return d;
    case "in_3h":
      d.setHours(d.getHours() + 3);
      return d;
    case "tomorrow":
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    case "next_week":
      d.setDate(d.getDate() + 7);
      d.setHours(9, 0, 0, 0);
      return d;
  }
}

export function LeadPeekSheet({
  lead,
  leads,
  onClose,
  onChanged,
  onConvert,
  onArchive,
  onUpdate,
  onOpenLead,
  onOpenDeal,
}: {
  lead: Lead | null;
  leads: Lead[];
  onClose: () => void;
  onChanged: () => void;
  onConvert: (lead: Lead) => void;
  onArchive: (lead: Lead) => void;
  onUpdate: (id: string, patch: Partial<Lead>) => Promise<void> | void;
  onOpenLead: (lead: Lead) => void;
  onOpenDeal?: (dealId: string) => void;
}) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<TimelineActivity[]>([]);
  const [people, setPeople] = useState<PersonLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"notes" | "activity" | "email" | "files">("notes");
  const [sourceContactName, setSourceContactName] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [planType, setPlanType] = useState<string>("call");
  const [planSubject, setPlanSubject] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeCtx, setComposeCtx] = useState<{ to: string; subject: string; threadId?: string }>(
    { to: "", subject: "" },
  );
  const [showOrg, setShowOrg] = useState(true);

  const isOpen = !!lead;
  const idx = lead ? leads.findIndex((l) => l.id === lead.id) : -1;
  const prevLead = idx > 0 ? leads[idx - 1] : null;
  const nextLead = idx >= 0 && idx < leads.length - 1 ? leads[idx + 1] : null;

  const reload = async () => {
    if (!lead) return;
    const { data } = await supabase
      .from("crm_activities")
      .select("id,type,subject,body,occurred_at,actor_id,metadata")
      .eq("entity_type", "lead")
      .eq("entity_id", lead.id)
      .order("occurred_at", { ascending: false })
      .limit(200);
    setActivities((data as TimelineActivity[]) || []);
  };

  useEffect(() => {
    if (!lead) {
      setActivities([]);
      setNoteDraft("");
      setPlanSubject("");
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      const [{ data: acts }, { data: p }] = await Promise.all([
        supabase
          .from("crm_activities")
          .select("id,type,subject,body,occurred_at,actor_id,metadata")
          .eq("entity_type", "lead")
          .eq("entity_id", lead.id)
          .order("occurred_at", { ascending: false })
          .limit(200),
        supabase.from("profiles").select("user_id,full_name,avatar_url").limit(500),
      ]);
      if (!active) return;
      setActivities((acts as TimelineActivity[]) || []);
      setPeople((p as PersonLite[]) || []);
      setLoading(false);

      // load source contact name
      if (lead.source_contact_id) {
        const { data: c } = await supabase
          .from("contacts")
          .select("first_name,last_name,email")
          .eq("id", lead.source_contact_id)
          .maybeSingle();
        if (active && c) {
          setSourceContactName(
            `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || null,
          );
        }
      } else if (active) {
        setSourceContactName(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [lead?.id]);

  const planned = useMemo(
    () =>
      activities.filter(
        (a) =>
          ["call", "meeting", "task", "email"].includes(a.type) &&
          new Date(a.occurred_at) > new Date(),
      ),
    [activities],
  );
  const done = useMemo(
    () => activities.filter((a) => new Date(a.occurred_at) <= new Date()),
    [activities],
  );

  if (!lead) {
    return (
      <Sheet open={false} onOpenChange={(v) => !v && onClose()}>
        <SheetContent />
      </Sheet>
    );
  }

  const isConverted = lead.status === "converted";
  const isArchived = lead.status === "archived";
  const convertedDealId = (lead as any).converted_deal_id as string | undefined;

  const addNote = async () => {
    const body = noteDraft.trim();
    if (!body || !user) return;
    const { data, error } = await supabase
      .from("crm_activities")
      .insert({
        workspace_id: lead.workspace_id,
        entity_type: "lead",
        entity_id: lead.id,
        type: "note",
        subject: "",
        body,
        actor_id: user.id,
      })
      .select("id,type,subject,body,occurred_at,actor_id,metadata")
      .single();
    if (error) {
      toast({ title: "Couldn't save note", description: error.message, variant: "destructive" });
      return;
    }
    setActivities((a) => [data as TimelineActivity, ...a]);
    setNoteDraft("");
    onChanged();
  };

  const planActivity = async (when: Date) => {
    if (!user) return;
    const subject =
      planSubject.trim() ||
      PLAN_TYPES.find((p) => p.value === planType)?.label ||
      "Activity";
    const { data, error } = await supabase
      .from("crm_activities")
      .insert({
        workspace_id: lead.workspace_id,
        entity_type: "lead",
        entity_id: lead.id,
        type: planType,
        subject,
        body: "",
        actor_id: user.id,
        occurred_at: when.toISOString(),
      })
      .select("id,type,subject,body,occurred_at,actor_id,metadata")
      .single();
    if (error) {
      toast({ title: "Couldn't plan activity", description: error.message, variant: "destructive" });
      return;
    }
    setActivities((a) => [data as TimelineActivity, ...a]);
    setPlanSubject("");
    await onUpdate(lead.id, { next_action_at: when.toISOString() });
    onChanged();
  };

  const openCompose = () => {
    if (!lead.email) return;
    setComposeCtx({ to: lead.email, subject: "" });
    setComposeOpen(true);
  };

  const handleSent = async (result: { threadId?: string; id?: string }) => {
    if (!user || !result.threadId) {
      void reload();
      return;
    }
    void reload();
  };

  const emailActivities = activities.filter((a) => a.type === "email");

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(v) => !v && onClose()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-5xl p-0 flex flex-col gap-0"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/50">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onClose}
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="flex flex-col">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-7"
                  disabled={!prevLead}
                  onClick={() => prevLead && onOpenLead(prevLead)}
                  title="Previous lead"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-7"
                  disabled={!nextLead}
                  onClick={() => nextLead && onOpenLead(nextLead)}
                  title="Next lead"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="ml-2 min-w-0">
                <div className="text-base font-semibold truncate">
                  {lead.name || lead.property_address || "Untitled lead"}
                </div>
                {lead.property_address && lead.name && (
                  <div className="text-xs text-muted-foreground truncate">{lead.property_address}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isConverted && (
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Converted
                </Badge>
              )}
              {isArchived && (
                <Badge variant="outline" className="text-muted-foreground">
                  Archived
                </Badge>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-[320px_1fr] min-h-0 overflow-hidden bg-background">
              {/* Left rail — same surface as main, just an inset divider */}
              <aside className="overflow-auto md:border-r md:border-border/40">
                <div className="p-6 space-y-4">
                  {/* PERSON */}
                  <section className="crm-card space-y-3">
                    <div className="crm-eyebrow">Person</div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">
                        <InlineText
                          value={lead.name}
                          placeholder="Name"
                          onSave={(v) => onUpdate(lead.id, { name: v || "" })}
                        />
                      </div>
                      {lead.title && (
                        <div className="text-xs text-muted-foreground">{lead.title}</div>
                      )}
                      <FieldRow icon={<Mail className="h-3.5 w-3.5" />}>
                        <InlineText
                          value={lead.email}
                          placeholder="Add email"
                          link={lead.email ? `mailto:${lead.email}` : undefined}
                          onSave={(v) => onUpdate(lead.id, { email: v || null })}
                        />
                      </FieldRow>
                      <FieldRow icon={<Phone className="h-3.5 w-3.5" />}>
                        <InlineText
                          value={lead.phone}
                          placeholder="Add phone"
                          link={lead.phone ? `tel:${lead.phone}` : undefined}
                          onSave={(v) => onUpdate(lead.id, { phone: v || null })}
                        />
                      </FieldRow>
                    </div>
                  </section>

                  {/* ORGANIZATION */}
                  <section className="crm-card space-y-3">
                    <button
                      onClick={() => setShowOrg((v) => !v)}
                      className="flex items-center justify-between w-full crm-eyebrow"
                    >
                      <span>Organization</span>
                      {showOrg ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    {showOrg && (
                      <FieldRow icon={<Building2 className="h-3.5 w-3.5" />}>
                        <InlineText
                          value={lead.company_name}
                          placeholder="Add company"
                          onSave={(v) => onUpdate(lead.id, { company_name: v || null })}
                        />
                      </FieldRow>
                    )}
                  </section>

                  {/* PROPERTY */}
                  <section className="crm-card space-y-3">
                    <div className="crm-eyebrow flex items-center gap-1.5">
                      <Home className="h-3 w-3" /> Property
                    </div>
                    <FieldRow icon={<MapPin className="h-3.5 w-3.5" />}>
                      <InlineText
                        value={lead.property_address ?? null}
                        placeholder="Full property address"
                        onSave={(v) => onUpdate(lead.id, { property_address: v } as any)}
                      />
                    </FieldRow>
                    <DetailRow icon="🏷" label="Type">
                      <Select
                        value={lead.property_type ?? ""}
                        onValueChange={(v) =>
                          onUpdate(lead.id, { property_type: v || null } as any)
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "SFR",
                            "SFR Portfolio",
                            "MF Small (2-4)",
                            "MF Large (5+)",
                            "Mixed Use",
                            "Commercial",
                            "Land",
                            "Other",
                          ].map((t) => (
                            <SelectItem key={t} value={t} className="text-xs">
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </DetailRow>
                    <div className="grid grid-cols-3 gap-1 text-xs">
                      <NumField
                        label="Units"
                        value={lead.units ?? null}
                        onSave={(n) => onUpdate(lead.id, { units: n } as any)}
                      />
                      <NumField
                        label="Beds"
                        value={lead.beds ?? null}
                        onSave={(n) => onUpdate(lead.id, { beds: n } as any)}
                      />
                      <NumField
                        label="Baths"
                        value={lead.baths ?? null}
                        step="0.5"
                        onSave={(n) => onUpdate(lead.id, { baths: n } as any)}
                      />
                    </div>
                    <NumField
                      label="Sqft"
                      value={lead.sqft ?? null}
                      onSave={(n) => onUpdate(lead.id, { sqft: n } as any)}
                    />
                    <NumField
                      label="Asking price ($)"
                      value={lead.asking_price ?? null}
                      onSave={(n) => onUpdate(lead.id, { asking_price: n } as any)}
                    />
                    <NumField
                      label="Cap rate (%)"
                      value={lead.listed_cap_rate ?? null}
                      step="0.01"
                      onSave={(n) => onUpdate(lead.id, { listed_cap_rate: n } as any)}
                    />
                    <NumField
                      label="Gross income ($)"
                      value={lead.gross_income ?? null}
                      onSave={(n) => onUpdate(lead.id, { gross_income: n } as any)}
                    />
                    <NumField
                      label="NOI ($)"
                      value={lead.noi ?? null}
                      onSave={(n) => onUpdate(lead.id, { noi: n } as any)}
                    />
                  </section>

                  {/* OWNER + NEXT FOLLOW UP */}
                  <section className="crm-card space-y-4">
                    <div className="crm-eyebrow">Assignment</div>
                    <div>
                      <OwnerPicker
                        ownerId={lead.owner_id}
                        onChange={(id) => onUpdate(lead.id, { owner_id: id })}
                      />
                    </div>
                    <DetailRow icon={<Clock className="h-3.5 w-3.5" />} label="Next follow up">
                      <FollowUpPicker
                        value={lead.next_action_at}
                        onChange={(iso) => onUpdate(lead.id, { next_action_at: iso })}
                        trigger={
                          <button className="text-sm text-left hover:text-primary truncate">
                            {lead.next_action_at
                              ? format(new Date(lead.next_action_at), "MMM d, h:mma")
                              : (
                                <span className="text-muted-foreground italic">Not scheduled</span>
                              )}
                          </button>
                        }
                      />
                    </DetailRow>
                  </section>

                  {/* SOURCE + ADDED (bottom) */}
                  <section className="crm-card space-y-4">
                    <div className="crm-eyebrow">Source</div>
                    <DetailRow icon="⬇" label="Source">
                      <InlineText
                        value={lead.source}
                        placeholder="Add source"
                        onSave={(v) => onUpdate(lead.id, { source: v })}
                      />
                    </DetailRow>
                    <ContactPicker
                      value={lead.source_contact_id ?? null}
                      onChange={(id, c) => {
                        onUpdate(lead.id, { source_contact_id: id } as any);
                        setSourceContactName(
                          c
                            ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() ||
                                c.email ||
                                null
                            : null,
                        );
                      }}
                      placeholder="Who sent this?"
                    />
                    <DetailRow icon={<CalendarIcon className="h-3.5 w-3.5" />} label="Added">
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(lead.created_at), "MMM d, yyyy")}
                      </span>
                    </DetailRow>
                  </section>
                </div>
              </aside>

              {/* Right column */}
              <div className="flex flex-col min-h-0 overflow-hidden">
                {/* Doc checklist + Buy Box header */}
                <div className="px-6 pt-6 pb-5 space-y-5 border-b border-border/40">
                  <DocChecklist
                    hasOm={!!lead.has_om}
                    hasT12={!!lead.has_t12}
                    hasRentRoll={!!lead.has_rent_roll}
                    createdAt={lead.created_at}
                    sourceContactName={sourceContactName}
                    onToggle={(field, value) => onUpdate(lead.id, { [field]: value } as any)}
                  />
                  <BuyBoxButtons
                    value={(lead.buy_box_fit as BuyBoxFit) || "unchecked"}
                    reason={lead.disqualification_reason ?? null}
                    onChange={(v) => onUpdate(lead.id, { buy_box_fit: v } as any)}
                    onReasonChange={(v) =>
                      onUpdate(lead.id, { disqualification_reason: v } as any)
                    }
                  />
                </div>

                <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col min-h-0">
                  <TabsList className="h-10 bg-transparent rounded-none border-b border-border/50 px-4 justify-start gap-1 w-full">
                    <TabsTrigger value="notes" className="data-[state=active]:bg-muted gap-1.5">
                      <NotebookPen className="h-3.5 w-3.5" /> Activity
                    </TabsTrigger>
                    <TabsTrigger value="activity" className="data-[state=active]:bg-muted gap-1.5">
                      <CalendarIcon className="h-3.5 w-3.5" /> Planned
                    </TabsTrigger>
                    <TabsTrigger value="email" className="data-[state=active]:bg-muted gap-1.5">
                      <Mail className="h-3.5 w-3.5" /> Email
                    </TabsTrigger>
                    <TabsTrigger value="files" className="data-[state=active]:bg-muted gap-1.5">
                      <Paperclip className="h-3.5 w-3.5" /> Files
                    </TabsTrigger>
                  </TabsList>

                  {/* ACTIVITY (NOTES + COMMENTS + EVENTS) TAB */}
                  <TabsContent value="notes" className="flex-1 overflow-hidden m-0 p-4">
                    <ActivityPanel entityType="lead" entityId={lead.id} hideHeader />
                  </TabsContent>

                  {/* ACTIVITY TAB */}
                  <TabsContent value="activity" className="flex-1 overflow-auto m-0 p-4 space-y-4">
                    <PlannedSection
                      planned={planned}
                      planType={planType}
                      planSubject={planSubject}
                      setPlanType={setPlanType}
                      setPlanSubject={setPlanSubject}
                      onChoosePreset={(k) => planActivity(presetDate(k))}
                      onCustom={(iso) => planActivity(new Date(iso))}
                    />
                    <DoneSection done={done} people={people} />
                  </TabsContent>

                  {/* EMAIL TAB */}
                  <TabsContent value="email" className="flex-1 overflow-auto m-0 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        {emailActivities.length === 0
                          ? "No emails logged yet."
                          : `${emailActivities.length} email${emailActivities.length === 1 ? "" : "s"}`}
                      </div>
                      <Button size="sm" disabled={!lead.email} onClick={openCompose}>
                        <Send className="h-3.5 w-3.5 mr-1.5" /> New email
                      </Button>
                    </div>
                    <CrmActivityTimeline
                      activities={emailActivities}
                      people={people}
                      onReply={(a) => {
                        const m = a.metadata as any;
                        setComposeCtx({
                          to: lead.email!,
                          subject: a.subject?.toLowerCase().startsWith("re:")
                            ? a.subject
                            : `Re: ${a.subject || ""}`,
                          threadId: m?.gmail_thread_id,
                        });
                        setComposeOpen(true);
                      }}
                    />
                  </TabsContent>
                  {/* FILES TAB */}
                  <TabsContent value="files" className="flex-1 overflow-auto m-0 p-4">
                    <LeadFilesTab
                      leadId={lead.id}
                      workspaceId={lead.workspace_id}
                      onDocsUpdated={(patch) => onUpdate(lead.id, patch as any)}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-border/50 px-4 py-3 flex items-center justify-between gap-2 bg-background">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
              {!isArchived && !isConverted && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Archive"
                  onClick={() => {
                    onArchive(lead);
                    onClose();
                  }}
                >
                  <Archive className="h-4 w-4" />
                </Button>
              )}
            </div>
            {isConverted && convertedDealId && onOpenDeal ? (
              <Button
                onClick={() => onOpenDeal(convertedDealId)}
                className="bg-brand-azure hover:bg-brand-azure/90 text-white h-11 px-6 rounded-xl"
              >
                Open deal
              </Button>
            ) : (
              <Button
                disabled={
                  isConverted ||
                  isArchived ||
                  !(lead.buy_box_fit === "yes" || lead.buy_box_fit === "maybe")
                }
                onClick={() => onConvert(lead)}
                className="bg-brand-azure hover:bg-brand-azure/90 text-white h-11 px-6 rounded-xl disabled:opacity-50"
                title={
                  !(lead.buy_box_fit === "yes" || lead.buy_box_fit === "maybe")
                    ? "Mark as Fits Buy Box or Maybe to enable conversion"
                    : undefined
                }
              >
                Convert to Deal <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            )}
          </div>
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

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground w-5 flex justify-center pt-0.5 text-xs">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}

function FieldRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-5 flex justify-center">{icon}</span>
      <div className="flex-1 min-w-0 text-sm">{children}</div>
    </div>
  );
}

function InlineText({
  value,
  placeholder,
  link,
  onSave,
}: {
  value: string | null;
  placeholder: string;
  link?: string;
  onSave: (v: string | null) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={async () => {
          setEditing(false);
          const next = draft.trim();
          if ((next || null) !== (value || null)) await onSave(next || null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(value ?? "");
            setEditing(false);
          }
        }}
        className="h-7 text-sm"
      />
    );
  }

  return (
    <div className="group flex items-center gap-1 min-w-0">
      {value ? (
        link ? (
          <a href={link} className="text-primary hover:underline truncate flex-1">
            {value}
          </a>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="truncate text-left flex-1 hover:bg-muted/40 rounded px-1 -mx-1 cursor-text"
            title="Click to edit"
          >
            {value}
          </button>
        )
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-muted-foreground italic flex-1 text-left hover:bg-muted/40 rounded px-1 -mx-1 cursor-text"
          title="Click to edit"
        >
          {placeholder}
        </button>
      )}
    </div>
  );
}

function PlannedSection({
  planned,
  planType,
  planSubject,
  setPlanType,
  setPlanSubject,
  onChoosePreset,
  onCustom,
}: {
  planned: TimelineActivity[];
  planType: string;
  planSubject: string;
  setPlanType: (v: string) => void;
  setPlanSubject: (v: string) => void;
  onChoosePreset: (k: "in_1h" | "in_3h" | "tomorrow" | "next_week") => void;
  onCustom: (iso: string) => void;
}) {
  const TypeIcon = PLAN_TYPES.find((p) => p.value === planType)?.icon || Phone;
  return (
    <section className="space-y-2">
      <div className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Planned
      </div>
      {planned.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center">
          You have no upcoming activities.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {planned.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-2 rounded-md border border-border/50 bg-card px-3 py-2 text-sm"
            >
              <Clock className="h-3.5 w-3.5 text-amber-600" />
              <span className="font-medium truncate">{p.subject || p.type}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {format(new Date(p.occurred_at), "MMM d, h:mma")}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="rounded-lg border border-border/50 bg-card p-2 flex items-center gap-2 flex-wrap">
        <Select value={planType} onValueChange={setPlanType}>
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <div className="flex items-center gap-1.5">
              <TypeIcon className="h-3.5 w-3.5" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {PLAN_TYPES.map((p) => (
              <SelectItem key={p.value} value={p.value} className="text-xs">
                <div className="flex items-center gap-1.5">
                  <p.icon className="h-3.5 w-3.5" /> {p.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={planSubject}
          onChange={(e) => setPlanSubject(e.target.value)}
          placeholder={PLAN_TYPES.find((p) => p.value === planType)?.label}
          className="h-8 text-sm flex-1 min-w-[120px]"
        />
        <div className="flex flex-wrap items-center gap-1">
          <PresetButton onClick={() => onChoosePreset("in_1h")}>In 1h</PresetButton>
          <PresetButton onClick={() => onChoosePreset("in_3h")}>In 3h</PresetButton>
          <PresetButton onClick={() => onChoosePreset("tomorrow")}>Tomorrow</PresetButton>
          <PresetButton onClick={() => onChoosePreset("next_week")}>Next week</PresetButton>
          <CustomDateButton onPick={onCustom} />
        </div>
      </div>
    </section>
  );
}

function PresetButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-1 rounded-md text-[11px] border border-border/50 bg-background hover:bg-muted text-foreground"
    >
      {children}
    </button>
  );
}

function CustomDateButton({ onPick }: { onPick: (iso: string) => void }) {
  const [val, setVal] = useState("");
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-2 py-1 rounded-md text-[11px] text-primary hover:underline"
      >
        + Other
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Input
        type="datetime-local"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="h-7 text-xs w-[180px]"
        autoFocus
      />
      <Button
        size="sm"
        className="h-7 text-xs"
        disabled={!val}
        onClick={() => {
          onPick(new Date(val).toISOString());
          setVal("");
          setOpen(false);
        }}
      >
        Set
      </Button>
      <button
        onClick={() => setOpen(false)}
        className="text-muted-foreground hover:text-foreground"
        title="Cancel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function DoneSection({
  done,
  people,
}: {
  done: TimelineActivity[];
  people: PersonLite[];
}) {
  return (
    <section className="space-y-2">
      <div className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Done
      </div>
      {done.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          No activity yet.
        </p>
      ) : (
        <CrmActivityTimeline activities={done} people={people} />
      )}
    </section>
  );
}

function NumField({
  label,
  value,
  step,
  onSave,
}: {
  label: string;
  value: number | null;
  step?: string;
  onSave: (n: number | null) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value !== null ? String(value) : "");
  useEffect(() => setDraft(value !== null ? String(value) : ""), [value]);

  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {editing ? (
        <Input
          autoFocus
          type="number"
          step={step}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false);
            const n = draft.trim() === "" ? null : Number(draft);
            if ((n ?? null) !== (value ?? null)) onSave(n);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setDraft(value !== null ? String(value) : "");
              setEditing(false);
            }
          }}
          className="h-6 w-24 text-xs"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-foreground hover:text-primary"
        >
          {value !== null ? value.toLocaleString() : <span className="text-muted-foreground italic">—</span>}
        </button>
      )}
    </div>
  );
}
