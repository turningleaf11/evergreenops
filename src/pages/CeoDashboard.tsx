import { useState, useEffect, useCallback } from "react";
import { useCEOContext } from "@/lib/ceo-context";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { useAuth } from "@/contexts/AuthContext";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Pencil, Check, Eye, Save, Star, Crosshair, Target, Mountain, Calendar, CheckCircle2 } from "lucide-react";
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
  const { user, isAdmin } = useAuth();

  const [editingObjective, setEditingObjective] = useState(false);
  const [objectiveDraft, setObjectiveDraft] = useState(data.currentObjective);

  // Vision state
  const [visionSections, setVisionSections] = useState<VisionSection[]>([]);
  const [visionEditing, setVisionEditing] = useState<string | null>(null);
  const [visionEditText, setVisionEditText] = useState("");
  const [visionGoals, setVisionGoals] = useState<{ id: string; title: string; status: string; quarter: string; year: number }[]>([]);

  // Triage state
  const [triageItems, setTriageItems] = useState<TriageItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null }[]>([]);

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
      if (data?.items) setTriageItems(data.items);
      else toast({ title: "No items extracted", description: "Try adding more detail to your notes." });
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
      <div className="max-w-5xl mx-auto px-6 pt-10 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground tracking-wide uppercase mb-1">{dateStr}</p>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Strategy Command Center</h1>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-16 space-y-6">
        {/* Current Objective — pinned */}
        <div className="border-b border-border pb-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">Current Objective</p>
          {editingObjective ? (
            <div className="flex items-center gap-2">
              <input
                value={objectiveDraft}
                onChange={(e) => setObjectiveDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveObjective()}
                className="flex-1 bg-transparent text-xl font-semibold text-foreground border-none outline-none placeholder:text-muted-foreground/30"
                placeholder="What is the one thing that matters right now?"
                autoFocus
              />
              <button onClick={saveObjective} className="text-primary hover:text-primary/80">
                <Check className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => { setEditingObjective(true); setObjectiveDraft(data.currentObjective); }}
              className="cursor-pointer group flex items-center gap-2"
            >
              <p className="text-xl font-semibold text-foreground">
                {data.currentObjective || <span className="text-muted-foreground/40 italic font-normal">Click to set your current objective...</span>}
              </p>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
        </div>

        {/* Tabbed cockpit */}
        <Tabs defaultValue="braindump" className="w-full">
          <TabsList className="w-full justify-start mb-4">
            <TabsTrigger value="braindump">Brain Dump</TabsTrigger>
            <TabsTrigger value="delegation">Delegation</TabsTrigger>
            <TabsTrigger value="command">Command</TabsTrigger>
            <TabsTrigger value="strategy">Strategy</TabsTrigger>
          </TabsList>

          {/* Brain Dump Tab */}
          <TabsContent value="braindump" className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-5">
              <ScratchPad onProcess={handleProcess} isProcessing={isProcessing} />
            </div>

            {triageItems.length > 0 && (
              <AiTriage
                items={triageItems}
                profiles={profiles}
                onItemProcessed={(idx) => setTriageItems(prev => prev.filter((_, i) => i !== idx))}
                onClear={() => setTriageItems([])}
              />
            )}
          </TabsContent>

          {/* Delegation Tab */}
          <TabsContent value="delegation">
            <DelegationBoard />
          </TabsContent>

          {/* Command Tab */}
          <TabsContent value="command" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest mb-4">CEO Briefing</h2>
                <div className="rounded-xl border border-border bg-card p-5">
                  <CeoBriefing />
                </div>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest mb-4">Top Priorities</h2>
                <div className="rounded-xl border border-border bg-card p-5">
                  <TopPriorities />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <MorningReset />
            </div>
          </TabsContent>

          {/* Strategy Tab */}
          <TabsContent value="strategy" className="space-y-6">
            {/* Strategy Creator */}
            <div className="rounded-xl border border-border bg-card p-5">
              <StrategyItemCreator />
            </div>

            {/* Review Feed */}
            <div className="rounded-xl border border-border bg-card p-5">
              <CeoReviewFeed />
            </div>

            {/* Decision Log */}
            <div>
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest mb-4">Decision Log</h2>
              <div className="rounded-xl border border-border bg-card p-5">
                <DecisionLog />
              </div>
            </div>

            {/* Vision — collapsed accordion */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">Vision &amp; Long-Term Targets</h2>
              </div>
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
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
