import { useState, useEffect, useCallback } from "react";
import { useCEOContext } from "@/lib/ceo-context";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { CeoBriefing } from "@/components/CeoBriefing";
import { TopPriorities } from "@/components/TopPriorities";
import { DecisionLog } from "@/components/DecisionLog";
import { MorningReset } from "@/components/MorningReset";
import { StrategyItemCreator } from "@/components/StrategyItemCreator";
import { CeoReviewFeed } from "@/components/CeoReviewFeed";
import { ScratchPad } from "@/components/ScratchPad";
import { AiTriage, type TriageItem } from "@/components/AiTriage";
import { DelegationBoard } from "@/components/DelegationBoard";
import { IdeaVault } from "@/components/ideas/IdeaVault";
import { ThisWeekTab } from "@/components/ThisWeekTab";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pencil, Check, Eye, Save, Star, Crosshair, Target, Mountain, Calendar, CheckCircle2, Binoculars } from "lucide-react";
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
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-8 pt-10 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground/70 tracking-wide uppercase mb-1">{dateStr}</p>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">{ceoPageName}</h1>
          </div>

          {/* Vision Portal — Binoculars icon */}
          <TooltipProvider>
            <Tooltip>
              <Sheet>
                <SheetTrigger asChild>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="rounded-full h-10 w-10 shrink-0 elevation-1 hover:elevation-2 transition-shadow duration-200">
                      <Binoculars className="h-4 w-4 text-primary" />
                    </Button>
                  </TooltipTrigger>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-primary" />
                      Vision &amp; Long-Term Targets
                    </SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">
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
                  </div>
                </SheetContent>
              </Sheet>
              <TooltipContent side="left">
                <p>Vision &amp; Long-Term Targets</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 pb-16 space-y-8">
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

        {/* 3-Tab cockpit */}
        <Tabs defaultValue="braindump" className="w-full">
          <TabsList className="w-full justify-start mb-6 bg-transparent">
            <TabsTrigger value="braindump">Brain Dump</TabsTrigger>
            {isPrimaryAdmin && <TabsTrigger value="ideas">Idea Vault</TabsTrigger>}
            {isPrimaryAdmin && <TabsTrigger value="thisweek">This Week</TabsTrigger>}
            <TabsTrigger value="command">Command</TabsTrigger>
            <TabsTrigger value="delegation">Delegation</TabsTrigger>
          </TabsList>

          {isPrimaryAdmin && (
            <TabsContent value="thisweek">
              <ThisWeekTab />
            </TabsContent>
          )}

          {/* Brain Dump Tab */}
          <TabsContent value="braindump" className="space-y-6">
            <div className="rounded-2xl bg-primary/[0.03] p-8 elevation-2">
              <ScratchPad onProcess={handleProcess} isProcessing={isProcessing} />
            </div>

            {triageItems.length > 0 && (
              <AiTriage
                items={triageItems}
                profiles={profiles}
                onItemProcessed={(id) => setTriageItems(prev => prev.filter((it) => it.id !== id))}
                onClear={() => setTriageItems([])}
              />
            )}
          </TabsContent>

          {/* Command Tab */}
          <TabsContent value="command" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-xs font-medium text-muted-foreground mb-4">CEO Briefing</h2>
                <div className="rounded-2xl border border-border/50 bg-card/80 p-6 elevation-1">
                  <CeoBriefing />
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <h2 className="text-xs font-medium text-muted-foreground mb-4">Top Priorities</h2>
                  <div className="rounded-2xl border border-border/50 bg-card/80 p-6 elevation-1">
                    <TopPriorities />
                  </div>
                </div>
                <div className="rounded-2xl border border-border/50 bg-card/80 p-6 elevation-1">
                  <MorningReset />
                </div>
              </div>
            </div>

            {/* Strategy Creator */}
            <div className="rounded-2xl border border-border/50 bg-card/80 p-6 elevation-1">
              <StrategyItemCreator />
            </div>

            {/* Review Feed */}
            <div className="rounded-2xl border border-border/50 bg-card/80 p-6 elevation-1">
              <CeoReviewFeed />
            </div>

            {/* Decision Log — collapsed accordion */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="decision-log" className="rounded-2xl border border-border/50 bg-card/80 px-6 elevation-1">
                <AccordionTrigger className="text-xs font-medium text-muted-foreground py-4">
                  Decision Log
                </AccordionTrigger>
                <AccordionContent>
                  <DecisionLog />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          {/* Idea Vault Tab */}
          {isPrimaryAdmin && (
            <TabsContent value="ideas">
              <div className="rounded-2xl border border-border/50 bg-card/80 p-6 elevation-1">
                <IdeaVault />
              </div>
            </TabsContent>
          )}

          {/* Delegation Tab */}
          <TabsContent value="delegation">
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
