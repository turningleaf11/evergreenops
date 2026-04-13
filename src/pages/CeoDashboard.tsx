import { useState, useEffect, useCallback } from "react";
import { useCEOContext } from "@/lib/ceo-context";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CeoBriefing } from "@/components/CeoBriefing";
import { TopPriorities } from "@/components/TopPriorities";
import { DecisionLog } from "@/components/DecisionLog";
import { StrategicTensions } from "@/components/StrategicTensions";
import { MorningReset } from "@/components/MorningReset";

import { StrategyItemCreator } from "@/components/StrategyItemCreator";
import { CeoReviewFeed } from "@/components/CeoReviewFeed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, ChevronDown, ChevronRight, Pencil, Check, Eye, Save, Star, Crosshair, Target, Mountain, Calendar, CheckCircle2 } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
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
  const [morningOpen, setMorningOpen] = useState(true);
  const [visionOpen, setVisionOpen] = useState(false);

  // Vision state
  const [visionSections, setVisionSections] = useState<VisionSection[]>([]);
  const [visionEditing, setVisionEditing] = useState<string | null>(null);
  const [visionEditText, setVisionEditText] = useState("");
  const [visionGoals, setVisionGoals] = useState<{ id: string; title: string; status: string; quarter: string; year: number }[]>([]);

  const fetchVision = useCallback(async () => {
    const [v, g] = await Promise.all([
      supabase.from("vision").select("*").order("sort_order"),
      supabase.from("goals").select("id, title, status, quarter, year").order("year", { ascending: false }).order("quarter"),
    ]);
    if (v.data) setVisionSections(v.data as VisionSection[]);
    if (g.data) setVisionGoals(g.data);
  }, []);

  useEffect(() => { fetchVision(); }, [fetchVision]);

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

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="max-w-4xl mx-auto px-6 pt-10 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground tracking-wide uppercase mb-1">{dateStr}</p>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Strategy Command Center</h1>
            <p className="text-sm text-muted-foreground mt-1">Evergreen Real Estate Ventures</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-16 space-y-8">
        {/* Current Objective */}
        <div className="border-b border-border pb-6">
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

        {/* Vision Section */}
        <Collapsible open={visionOpen} onOpenChange={setVisionOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
            {visionOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <Eye className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">Vision</h2>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4 space-y-4">
            {visionSections.map(section => {
              const meta = sectionMeta[section.section];
              if (!meta) return null;
              const Icon = meta.icon;
              const content = section.content as any;
              const text = content?.text || "";
              const isEditing = visionEditing === section.id;

              return (
                <Card key={section.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        {meta.label}
                      </CardTitle>
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
                    <p className="text-xs text-muted-foreground">{meta.description}</p>
                  </CardHeader>
                  <CardContent>
                    {isEditing ? (
                      <Textarea value={visionEditText} onChange={e => setVisionEditText(e.target.value)} rows={4} className="text-sm" />
                    ) : text ? (
                      <p className="text-sm text-foreground whitespace-pre-wrap">{text}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Not yet defined. {isAdmin && "Click the pencil to add content."}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Quarterly Rocks
                </CardTitle>
                <p className="text-xs text-muted-foreground">Auto-pulled from Execution Hub goals for the current quarter</p>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* Morning Reset */}
        <Collapsible open={morningOpen} onOpenChange={setMorningOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
            {morningOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">Morning Reset</h2>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <MorningReset />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Two-column layout: Briefing + Priorities */}
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

        {/* Strategic Tensions */}
        <div>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest mb-4">Strategic Tensions</h2>
          <div className="rounded-xl border border-border bg-card p-5">
            <StrategicTensions />
          </div>
        </div>

        {/* Strategy Items Manager */}
        <div>
          <div className="rounded-xl border border-border bg-card p-5">
            <StrategyItemCreator />
          </div>
        </div>

        {/* CEO Review Feed */}
        <div>
          <div className="rounded-xl border border-border bg-card p-5">
            <CeoReviewFeed />
          </div>
        </div>

        {/* Decision Log */}
        <div>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest mb-4">Decision Log</h2>
          <div className="rounded-xl border border-border bg-card p-5">
            <DecisionLog />
          </div>
        </div>
      </div>

    </div>
  );
}
