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
import { Button } from "@/components/ui/button";
import {
  EntitySheetShell,
  EntitySheetHeader,
  EntityIdentityStrip,
  EntityTabs,
  EntityTabPanel,
  EntitySidebarSection,
  EntitySidebarField,
  EntityEmpty,
  OverviewCard,
  StageProgressBar,
} from "./_shell";
import { EntityComposer } from "./EntityComposer";
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
import { FollowUpPicker } from "./FollowUpPicker";
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
  const [tab, setTab] = useState<"overview" | "activity" | "files">("overview");
  const [composerNonce, setComposerNonce] = useState(0);
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
      <EntitySheetShell open={false} onOpenChange={(v) => !v && onClose()} width="wide">
        <div />
      </EntitySheetShell>
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

  const buyBoxFit = (lead.buy_box_fit as BuyBoxFit) || "unchecked";
  const buyBoxMeta = BUY_BOX_META[buyBoxFit];

  return (
    <>
      <EntitySheetShell
        open={isOpen}
        onOpenChange={(v) => !v && onClose()}
        loading={loading}
        width="wide"
      >
          <EntitySheetHeader
            title={lead.property_address || lead.name || "Untitled lead"}
            subtitle={
              sourceContactName
                ? `Sent by ${sourceContactName}`
                : lead.source
                  ? `Source: ${lead.source}`
                  : undefined
            }
            titleClassName="text-[20px] font-semibold"
            onClose={onClose}
            onPrev={prevLead ? () => onOpenLead(prevLead) : undefined}
            onNext={nextLead ? () => onOpenLead(nextLead) : undefined}
            prevDisabled={!prevLead}
            nextDisabled={!nextLead}
            actions={
              <>
                {buyBoxFit !== "unchecked" && (
                  <span
                    className={cn(
                      "inline-flex items-center font-semibold text-[11px]",
                      buyBoxMeta.bg,
                    )}
                    style={{ borderRadius: 100, padding: "3px 10px" }}
                  >
                    {buyBoxMeta.label}
                  </span>
                )}
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
                {isConverted && convertedDealId && onOpenDeal ? (
                  <Button
                    size="sm"
                    onClick={() => onOpenDeal(convertedDealId)}
                    className="bg-brand-azure hover:bg-brand-azure/90 text-white rounded-xl"
                  >
                    Open deal <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={
                      isConverted ||
                      isArchived ||
                      !(lead.buy_box_fit === "yes" || lead.buy_box_fit === "maybe")
                    }
                    onClick={() => onConvert(lead)}
                    className="bg-brand-azure hover:bg-brand-azure/90 text-white rounded-xl disabled:opacity-50"
                    title={
                      !(lead.buy_box_fit === "yes" || lead.buy_box_fit === "maybe")
                        ? "Mark as Fits Buy Box or Maybe to enable conversion"
                        : undefined
                    }
                  >
                    Convert to Deal <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                )}
              </>
            }
          />
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              {/* Full-width stage progression bar */}
              <div className="px-6 pt-4 pb-4 bg-background border-b border-border/50">
                <StageProgressBar
                  stages={[
                    { id: "new", label: "New" },
                    { id: "working", label: "Working" },
                    { id: "qualified", label: "Qualified" },
                    { id: "converted", label: "Converted", isWon: true },
                    { id: "archived", label: "Archived", isLost: true },
                  ]}
                  currentId={lead.status}
                  onChange={(id) => onUpdate(lead.id, { status: id } as any)}
                  disabled={isConverted || isArchived}
                />
              </div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_300px] min-h-0 overflow-hidden">
              {/* MAIN: composer + tabs */}
              <div className="flex flex-col min-h-0 bg-[#F8F8F8] dark:bg-muted/10">
                {/* Composer pinned above the tabs */}
                <div className="shrink-0 px-6 pt-5 pb-4 bg-background border-b border-border/50">
                  <EntityComposer
                    workspaceId={lead.workspace_id}
                    entityType="lead"
                    entityId={lead.id}
                    defaultEmail={lead.email}
                    notePlaceholder="Jot a note about this lead…"
                    onPosted={() => {
                      setComposerNonce((n) => n + 1);
                      void reload();
                    }}
                  />
                </div>

                <EntityTabs
                  value={tab}
                  onValueChange={(v) => setTab(v as any)}
                  tabs={[
                    { id: "overview", label: "Overview" },
                    { id: "activity", label: "Activity" },
                    { id: "files", label: "Files" },
                  ]}
                  className="bg-background"
                >
                  <EntityTabPanel value="overview" className="p-6">
                    <div className="space-y-4 max-w-3xl">
                      {/* Buy Box Check */}
                      <OverviewCard title="Buy Box Check">
                        <DocChecklist
                          hasOm={!!lead.has_om}
                          hasT12={!!lead.has_t12}
                          hasRentRoll={!!lead.has_rent_roll}
                          createdAt={lead.created_at}
                          sourceContactName={sourceContactName}
                          onToggle={(field, value) =>
                            onUpdate(lead.id, { [field]: value } as any)
                          }
                        />
                        <div className="pt-2">
                          <BuyBoxButtons
                            value={buyBoxFit}
                            reason={lead.disqualification_reason ?? null}
                            onChange={(v) => onUpdate(lead.id, { buy_box_fit: v } as any)}
                            onReasonChange={(v) =>
                              onUpdate(lead.id, { disqualification_reason: v } as any)
                            }
                          />
                        </div>
                      </OverviewCard>

                      {/* Property */}
                      <OverviewCard title="Property">
                        <div>
                          <div className="crm-field-label">Property address</div>
                          <div className="relative">
                            <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input
                              defaultValue={lead.property_address ?? ""}
                              placeholder="Full property address"
                              className="pl-8 h-9"
                              onBlur={(e) =>
                                onUpdate(lead.id, {
                                  property_address: e.target.value || null,
                                } as any)
                              }
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <div className="crm-field-label">Type</div>
                            <Select
                              value={lead.property_type ?? ""}
                              onValueChange={(v) =>
                                onUpdate(lead.id, { property_type: v || null } as any)
                              }
                            >
                              <SelectTrigger className="h-9 text-sm">
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
                                  <SelectItem key={t} value={t} className="text-sm">
                                    {t}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <NumField
                            label="Units"
                            value={lead.units ?? null}
                            onSave={(n) => onUpdate(lead.id, { units: n } as any)}
                          />
                          <NumField
                            label="Sqft"
                            value={lead.sqft ?? null}
                            onSave={(n) => onUpdate(lead.id, { sqft: n } as any)}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
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
                      </OverviewCard>

                      {/* Financials */}
                      <OverviewCard title="Financials">
                        <div>
                          <div className="crm-field-label">Asking price</div>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                              $
                            </span>
                            <Input
                              type="number"
                              defaultValue={lead.asking_price ?? ""}
                              placeholder="0"
                              className="pl-7 h-10 text-base font-semibold tabular-nums"
                              onBlur={(e) =>
                                onUpdate(lead.id, {
                                  asking_price:
                                    e.target.value === "" ? null : Number(e.target.value),
                                } as any)
                              }
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <NumField
                            label="Listed cap rate (%)"
                            value={lead.listed_cap_rate ?? null}
                            step="0.01"
                            onSave={(n) =>
                              onUpdate(lead.id, { listed_cap_rate: n } as any)
                            }
                          />
                          <NumField
                            label="Gross income ($)"
                            value={lead.gross_income ?? null}
                            onSave={(n) => onUpdate(lead.id, { gross_income: n } as any)}
                          />
                        </div>
                        <NumField
                          label="NOI ($)"
                          value={lead.noi ?? null}
                          onSave={(n) => onUpdate(lead.id, { noi: n } as any)}
                        />
                      </OverviewCard>

                      {/* Source */}
                      <OverviewCard title="Source">
                        <div>
                          <div className="crm-field-label">Who sent this?</div>
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
                            placeholder="Select source contact"
                          />
                        </div>
                        <div>
                          <div className="crm-field-label">Source type</div>
                          <Input
                            defaultValue={lead.source ?? ""}
                            placeholder="email / form / outreach / referral"
                            className="h-9"
                            onBlur={(e) =>
                              onUpdate(lead.id, { source: e.target.value || null })
                            }
                          />
                        </div>
                        <div>
                          <div className="crm-field-label">Date added</div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(lead.created_at), "MMM d, yyyy")}
                          </div>
                        </div>
                      </OverviewCard>
                    </div>
                  </EntityTabPanel>

                  <EntityTabPanel value="activity" className="p-6 overflow-hidden">
                    <div className="h-full flex flex-col max-w-3xl">
                      <ActivityPanel
                        key={composerNonce}
                        entityType="lead"
                        entityId={lead.id}
                        hideHeader
                      />
                    </div>
                  </EntityTabPanel>

                  <EntityTabPanel value="files" className="p-6">
                    <div className="max-w-3xl">
                      <LeadFilesTab
                        leadId={lead.id}
                        workspaceId={lead.workspace_id}
                        onDocsUpdated={(patch) => onUpdate(lead.id, patch as any)}
                      />
                    </div>
                  </EntityTabPanel>
                </EntityTabs>
              </div>

              {/* SIDEBAR */}
              <aside className="overflow-auto border-l border-border/50 bg-background">
                <div className="p-5 space-y-5">
                  <EntitySidebarSection title="Owner">
                    <OwnerPicker
                      ownerId={lead.owner_id}
                      onChange={(id) => onUpdate(lead.id, { owner_id: id })}
                    />
                  </EntitySidebarSection>

                  <EntitySidebarSection title="Status">
                    <EntitySidebarField label="Buy box">
                      <span className="text-sm text-foreground">
                        {buyBoxMeta?.label || "Unchecked"}
                      </span>
                    </EntitySidebarField>
                    <EntitySidebarField label="Stage">
                      <span className="text-sm text-foreground capitalize">
                        {lead.status?.replace(/_/g, " ") || "—"}
                      </span>
                    </EntitySidebarField>
                  </EntitySidebarSection>

                  <EntitySidebarSection title="Contact">
                    <EntitySidebarField label="Source contact">
                      {sourceContactName ? (
                        <span className="text-sm">{sourceContactName}</span>
                      ) : (
                        <EntityEmpty>Not set</EntityEmpty>
                      )}
                    </EntitySidebarField>
                    <EntitySidebarField label="Email">
                      {lead.email ? (
                        <a
                          href={`mailto:${lead.email}`}
                          className="text-sm hover:text-primary break-all"
                        >
                          {lead.email}
                        </a>
                      ) : (
                        <EntityEmpty>—</EntityEmpty>
                      )}
                    </EntitySidebarField>
                    <EntitySidebarField label="Phone">
                      {lead.phone ? (
                        <a
                          href={`tel:${lead.phone}`}
                          className="text-sm hover:text-primary"
                        >
                          {lead.phone}
                        </a>
                      ) : (
                        <EntityEmpty>—</EntityEmpty>
                      )}
                    </EntitySidebarField>
                    {lead.company_name && (
                      <EntitySidebarField label="Company">
                        <span className="text-sm">{lead.company_name}</span>
                      </EntitySidebarField>
                    )}
                  </EntitySidebarSection>

                  <EntitySidebarSection title="Follow up">
                    <FollowUpPicker
                      value={lead.next_action_at}
                      onChange={(iso) =>
                        onUpdate(lead.id, { next_action_at: iso })
                      }
                      trigger={
                        <button className="text-sm text-left hover:text-primary truncate w-full">
                          {lead.next_action_at ? (
                            format(new Date(lead.next_action_at), "MMM d, h:mma")
                          ) : (
                            <span className="text-muted-foreground italic">
                              Not scheduled
                            </span>
                          )}
                        </button>
                      }
                    />
                  </EntitySidebarSection>

                  <EntitySidebarSection title="Created">
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(lead.created_at), "MMM d, yyyy")}
                    </div>
                  </EntitySidebarSection>
                </div>
              </aside>
            </div>
          )}


          {/* Footer */}
          {!isArchived && !isConverted && (
            <div className="border-t border-border/50 px-4 py-2 flex items-center justify-end gap-2 bg-background">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  onArchive(lead);
                  onClose();
                }}
              >
                <Archive className="h-3.5 w-3.5" />
                Archive
              </Button>
            </div>
          )}
      </EntitySheetShell>

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
