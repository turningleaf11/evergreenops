import { useState } from "react";
import { useCEOContext } from "@/lib/ceo-context";
import { CeoBriefing } from "@/components/CeoBriefing";
import { TopPriorities } from "@/components/TopPriorities";
import { DecisionLog } from "@/components/DecisionLog";
import { StrategicTensions } from "@/components/StrategicTensions";
import { MorningReset } from "@/components/MorningReset";
import { CeoAiChat } from "@/components/CeoAiChat";
import { StrategyItemCreator } from "@/components/StrategyItemCreator";
import { CeoReviewFeed } from "@/components/CeoReviewFeed";
import { Bot, ChevronDown, ChevronRight, Pencil, Check } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

export default function CeoDashboard() {
  const { data, update } = useCEOContext();
  const [chatOpen, setChatOpen] = useState(false);
  const [editingObjective, setEditingObjective] = useState(false);
  const [objectiveDraft, setObjectiveDraft] = useState(data.currentObjective);
  const [morningOpen, setMorningOpen] = useState(true);

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
          <button
            onClick={() => setChatOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 hover:bg-primary/10 text-primary text-sm font-medium transition-colors"
          >
            <Bot className="h-4 w-4" />
            Strategy AI
          </button>
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

      {/* AI Chat Sidebar */}
      <CeoAiChat open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  );
}
