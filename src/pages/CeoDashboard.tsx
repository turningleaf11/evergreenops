import { useState, useEffect, useCallback } from "react";
import { useCEOContext } from "@/lib/ceo-context";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { CeoBriefing } from "@/components/CeoBriefing";
import { TopPriorities } from "@/components/TopPriorities";
import { DecisionLog } from "@/components/DecisionLog";
import { StrategyItemCreator } from "@/components/StrategyItemCreator";
import { CeoReviewFeed } from "@/components/CeoReviewFeed";
import { ScratchPad } from "@/components/ScratchPad";
import { AiTriage, type TriageItem } from "@/components/AiTriage";
import { DelegationBoard } from "@/components/DelegationBoard";
import { DirectivesStatusBoard } from "@/components/DirectivesStatusBoard";
import { IdeaVault } from "@/components/ideas/IdeaVault";
import { ThisWeekTab } from "@/components/ThisWeekTab";
import { DailyBriefingCard } from "@/components/ceo/DailyBriefingCard";
import { TodaysPriorities } from "@/components/ceo/TodaysPriorities";
import { StrategicQuestionCard } from "@/components/ceo/StrategicQuestionCard";
import { PersonalTodos } from "@/components/ceo/PersonalTodos";
import { AssignedTasks } from "@/components/ceo/AssignedTasks";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Check, Eye, Save, Star, Crosshair, Target, Mountain, Calendar, CheckCircle2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type VisionSection = {
  id: string; section: string; content: { text?: string; items?: string[] };
  sort_order: number; updated_at: string; updated_by: string | null;
};

const sectionMeta: Record<string, { label: string; icon: React.ElementType; description: string }> = {
  core_values: { label: "Core Values", icon: Star, description: "3-5 guiding principles that define how your team operates" },
  core_focus_purpose: { label: "Core Focus — Purpose", icon: Crosshair, description: "Why does this company exist?" },
  core_focus_niche: { label: "Core Focus — Niche", icon: Crosshair, description: "What are you best at? Who do you serve?" },
  ten_year_target: { label: "10-Year Target", icon: Mountain, description: "Your big, audacious, long-term goal" },
  three_year_picture: { label: "3-Year Picture", icon: Target, description: "What does the company look like in 3 years?" },
  one_year_plan: { label: "1-Year Plan", icon: Calendar, description: "Key objectives and revenue/profit targets for this year" },
};

export default function CeoDashboard() {
  const { data, update } = useCEOContext();
  const { user, isPrimaryAdmin } = useAuth();
  const { ceoPageName } = useWorkspace();

  const [editingObjective, setEditingObjective] = useState(false);
  const [objectiveDraft, setObjectiveDraft] = useState(data.currentObjective);

  // Vision state
  const [visionSections, setVisionSections] = useState<VisionSection[]>([]);
  const [visionEditing, setVisionEditing] = useState<string | null>(null);
  const [visionEditText, setVisionEditText] = useState("");
  const [visionGoals, setVisionGoals] = useState<{ id: string; title: string; status: string; quarter: string; year: number }[]>([]);

  // Triage state — backed by ceo_triage_pending so it persists across navigation
  const [triageItems, setTriageItems] = useState<TriageItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null }[]>([]);

  const [activeTab, setActiveTab] = useState<string>("today");
  const [briefingOpen, setBriefingOpen] = useState(false);

  const loadPendingTriage = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("ceo_triage_pending")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (data) setTriageItems(data as unknown as TriageItem[]);
  }, [user]);

  useEffect(() => { loadPendingTriage(); }, [loadPendingTriage]);

  // Realtime: keep panel in sync if rows change elsewhere
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`triage-pending-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ceo_triage_pending", filter: `user_id=eq.${user.id}` }, () => {
        loadPendingTriage();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadPendingTriage]);

  const fetchVision = useCallback(async () => {
    const [v, g] = await Promise.all([
      supabase.from("vision").select("*").order("sort_order"),
      supabase.from("goals").select("id, title, status, quarter, year").order("year", { ascending: false }).order("quarter"),
    ]);
    if (v.data) setVisionSections(v.data as VisionSection[]);
    if (g.data) setVisionGoals(g.data);
  }, []);

  useEffect(() => { fetchVision(); }, [fetchVision]);

  useEffect(() => {
    supabase.from("profiles").select("user_id, full_name").then(({ data }) => {
      if (data) setProfiles(data);
    });
  }, []);

  const startVisionEdit = (section: VisionSection) => {
    setVisionEditing(section.id);
    const content = section.content as any;
    setVisionEditText(content?.text || (content?.items || []).join("\n") || "");
  };

  const saveVisionEdit = async (section: VisionSection) => {
    const { error } = await supabase.from("vision").update({
      content: { text: visionEditText },
      updated_by: user?.id,
    }).eq("id", section.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Saved" }); setVisionEditing(null); fetchVision(); }
  };

  const currentQuarterGoals = visionGoals.filter(g => {
    const now = new Date();
    const q = `Q${Math.floor(now.getMonth() / 3) + 1}`;
    return g.year === now.getFullYear() && g.quarter === q;
  });

  const saveObjective = () => {
    update({ currentObjective: objectiveDraft });
    setEditingObjective(false);
  };

  const handleProcess = async (text: string, images: string[]) => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ceo-triage", {
        body: { content: text, images },
      });
      if (error) throw error;
      if (data?.items?.length) {
        setTriageItems((prev) => [...prev, ...(data.items as TriageItem[])]);
      } else {
        toast({ title: "No items extracted", description: "Try adding more detail to your notes." });
      }
    } catch (err: any) {
      toast({ title: "Processing failed", description: err.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="min-h-screen relative bg-background">
      {/* Premium command-center backdrop — accent-tinted gradient + soft radial glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-background to-background"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] opacity-70"
        style={{
          background:
            "radial-gradient(60% 50% at 20% 0%, hsl(var(--primary) / 0.10), transparent 70%), radial-gradient(50% 40% at 85% 10%, hsl(var(--primary) / 0.07), transparent 70%)",
        }}
      />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-8 pt-8 sm:pt-12 pb-6 sm:pb-8">
        <div className="flex items-end justify-between gap-4 sm:gap-6">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] text-primary/80 tracking-[0.2em] uppercase font-semibold mb-1.5 sm:mb-2 truncate">
              {dateStr}
            </p>
            <h1 className="text-2xl sm:text-4xl font-bold text-foreground tracking-tight leading-tight truncate">
              {ceoPageName}
            </h1>
            <div className="mt-3 h-px w-24 bg-gradient-to-r from-primary/60 to-transparent" />
          </div>

        </div>
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-8 pb-16 space-y-8 sm:space-y-10">
        {/* Current Objective — slim pinned context line */}
        <div className="mb-2">
          <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-widest mb-1.5">Current Objective</p>
          {editingObjective ? (
            <div className="flex items-center gap-2">
              <input
                value={objectiveDraft}
                onChange={(e) => setObjectiveDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveObjective()}
                className="flex-1 bg-transparent text-base font-medium text-foreground border-none outline-none placeholder:text-muted-foreground/30"
                placeholder="What is the one thing that matters right now?"
                autoFocus
              />
              <button onClick={saveObjective} className="text-primary hover:text-primary/80 transition-colors duration-150">
                <Check className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => { setEditingObjective(true); setObjectiveDraft(data.currentObjective); }}
              className="cursor-pointer group flex items-center gap-2"
            >
              <p className="text-base font-medium text-foreground">
                {data.currentObjective || <span className="text-muted-foreground/40 italic font-normal">Click to set your current objective...</span>}
              </p>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
            </div>
          )}
        </div>

        {/* 4-Tab cockpit */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start mb-6 bg-transparent">
            <TabsTrigger value="today">Today</TabsTrigger>
            {isPrimaryAdmin && <TabsTrigger value="thisweek">This Week</TabsTrigger>}
            <TabsTrigger value="bigpicture">Big Picture</TabsTrigger>
            <TabsTrigger value="delegation">Delegation</TabsTrigger>
          </TabsList>

          {/* Today Tab */}
          <TabsContent value="today">
            <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 items-start">
              {/* Left — action items */}
              <div className="space-y-4">
                {isPrimaryAdmin && <TodaysPriorities />}
                {isPrimaryAdmin && <PersonalTodos />}
                {isPrimaryAdmin && <AssignedTasks />}
              </div>

              {/* Right — AI briefing + scratchpad */}
              <div className="space-y-4">
                {isPrimaryAdmin && (
                  <div>
                    {/* AI Daily Briefing — premium styled trigger */}
                    <button
                      onClick={() => setBriefingOpen((o) => !o)}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-primary/25 bg-gradient-to-r from-primary/[0.06] to-primary/[0.02] hover:border-primary/40 hover:from-primary/[0.10] hover:to-primary/[0.05] transition-all text-xs font-medium text-primary/70 hover:text-primary"
                    >
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-50" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary/70" />
                      </span>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>AI Daily Briefing</span>
                      <span className="ml-auto opacity-60">
                        {briefingOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                    {briefingOpen && (
                      <div className="mt-3 space-y-4">
                        <DailyBriefingCard compact />
                        <StrategicQuestionCard />
                      </div>
                    )}
                  </div>
                )}

                {/* Scratchpad — owns the right column */}
                <div className="rounded-2xl bg-primary/[0.03] border border-border/30 p-5 elevation-1">
                  <ScratchPad onProcess={handleProcess} isProcessing={isProcessing} />
                </div>
              </div>
            </div>

            {triageItems.length > 0 && (
              <div className="mt-6">
                <AiTriage
                  items={triageItems}
                  profiles={profiles}
                  onItemProcessed={(id) => setTriageItems(prev => prev.filter((it) => it.id !== id))}
                  onClear={() => setTriageItems([])}
                />
              </div>
            )}
          </TabsContent>

          {/* This Week Tab */}
          {isPrimaryAdmin && (
            <TabsContent value="thisweek">
              <ThisWeekTab />
            </TabsContent>
          )}

          {/* Big Picture Tab */}
          <TabsContent value="bigpicture" className="space-y-12 divide-y divide-border/40">
            {/* Section 1 — Vision */}
            <section className="rounded-2xl border border-border/50 bg-card/80 p-7 elevation-1">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2 tracking-tight">
                  <Eye className="h-4 w-4 text-primary" />
                  Vision &amp; Long-Term Targets
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  The foundation everything else is built on.
                </p>
              </div>
              <VisionAccordion
                visionSections={visionSections}
                visionEditing={visionEditing}
                visionEditText={visionEditText}
                setVisionEditText={setVisionEditText}
                startVisionEdit={startVisionEdit}
                saveVisionEdit={saveVisionEdit}
                currentQuarterGoals={currentQuarterGoals}
                isAdmin={isPrimaryAdmin}
              />
            </section>

            {/* Section 2 — Strategy */}
            <section className="rounded-2xl border border-border/50 bg-card/80 p-7 elevation-1 pt-12">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-foreground tracking-tight">Directives</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Active directives cascading to your teams.
                </p>
              </div>
              <StrategyItemCreator />
            </section>

            {/* Section 3 — Idea Vault */}
            <section className="rounded-2xl border border-border/50 bg-card/80 p-7 elevation-1 pt-12">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-foreground tracking-tight">Idea Vault</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Raw thinking captured from Brain Dump. Promote when ready.
                </p>
              </div>
              <IdeaVault />
            </section>
          </TabsContent>

          {/* Delegation Tab */}
          <TabsContent value="delegation" className="space-y-8">
            <DirectivesStatusBoard />
            <DelegationBoard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ── Vision Accordion (used inside Sheet) ── */
function VisionAccordion({
  visionSections,
  visionEditing,
  visionEditText,
  setVisionEditText,
  startVisionEdit,
  saveVisionEdit,
  currentQuarterGoals,
  isAdmin,
}: {
  visionSections: VisionSection[];
  visionEditing: string | null;
  visionEditText: string;
  setVisionEditText: (t: string) => void;
  startVisionEdit: (s: VisionSection) => void;
  saveVisionEdit: (s: VisionSection) => void;
  currentQuarterGoals: { id: string; title: string; status: string }[];
  isAdmin: boolean;
}) {
  return (
    <Accordion type="multiple" className="w-full">
      {visionSections.map(section => {
        const meta = sectionMeta[section.section];
        if (!meta) return null;
        const Icon = meta.icon;
        const content = section.content as any;
        const text = content?.text || "";
        const isEditing = visionEditing === section.id;

        return (
          <AccordionItem key={section.id} value={section.id}>
            <AccordionTrigger className="text-sm font-medium py-3">
              <span className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-primary" />
                {meta.label}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">{meta.description}</p>
                {isAdmin && !isEditing && (
                  <Button variant="ghost" size="sm" onClick={() => startVisionEdit(section)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
                {isAdmin && isEditing && (
                  <Button variant="ghost" size="sm" onClick={() => saveVisionEdit(section)}>
                    <Save className="h-3 w-3" />
                  </Button>
                )}
              </div>
              {isEditing ? (
                <Textarea value={visionEditText} onChange={e => setVisionEditText(e.target.value)} rows={4} className="text-sm" />
              ) : text ? (
                <p className="text-sm text-foreground whitespace-pre-wrap">{text}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Not yet defined. {isAdmin && "Click the pencil to add content."}</p>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}

      <AccordionItem value="quarterly-rocks">
        <AccordionTrigger className="text-sm font-medium py-3">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            Quarterly Rocks
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <p className="text-xs text-muted-foreground mb-2">Auto-pulled from Execution Hub goals for the current quarter</p>
          {currentQuarterGoals.length > 0 ? (
            <ul className="space-y-2">
              {currentQuarterGoals.map(g => (
                <li key={g.id} className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full ${g.status === "done" ? "bg-green-500" : g.status === "at_risk" ? "bg-red-500" : "bg-blue-500"}`} />
                  {g.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground italic">No goals for the current quarter.</p>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
