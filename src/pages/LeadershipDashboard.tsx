import { useState } from "react";
import { useParams } from "react-router-dom";
import { departments } from "@/lib/mock-data";
import { StrategyFeed } from "@/components/StrategyFeed";
import { TranslationBlockComponent } from "@/components/TranslationBlock";
import { ExecutionSnapshot } from "@/components/ExecutionSnapshot";
import { UpwardProposalForm } from "@/components/UpwardProposal";
import { LeadershipAiChat } from "@/components/LeadershipAiChat";
import { Bot, Zap, Brain } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function LeadershipDashboard() {
  const { deptId } = useParams<{ deptId: string }>();
  const dept = departments.find((d) => d.id === deptId);
  const [chatOpen, setChatOpen] = useState(false);

  if (!dept) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Department not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="max-w-5xl mx-auto px-6 pt-10 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground tracking-wide uppercase mb-1">Leadership Dashboard</p>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">{dept.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{dept.description}</p>
          </div>
          <button
            onClick={() => setChatOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 hover:bg-primary/10 text-primary text-sm font-medium transition-colors"
          >
            <Bot className="h-4 w-4" />
            Leadership AI
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-16">
        <Tabs defaultValue="execution" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="execution" className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              Execution Mode
            </TabsTrigger>
            <TabsTrigger value="think" className="flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5" />
              Think + Improve
            </TabsTrigger>
          </TabsList>

          {/* Execution Mode */}
          <TabsContent value="execution" className="space-y-8">
            {/* Strategy Feed */}
            <div>
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest mb-4">Strategy Feed</h2>
              <div className="rounded-xl border border-border bg-card p-5">
                <StrategyFeed departmentId={dept.id} />
              </div>
            </div>

            {/* Translation Block */}
            <div>
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest mb-4">Translation Required</h2>
              <div className="rounded-xl border border-border bg-card p-5">
                <TranslationBlockComponent departmentId={dept.id} />
              </div>
            </div>

            {/* Two-column: Execution Snapshot + Upward Proposals */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest mb-4">Execution Snapshot</h2>
                <div className="rounded-xl border border-border bg-card p-5">
                  <ExecutionSnapshot departmentId={dept.id} />
                </div>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest mb-4">Promote Upward</h2>
                <div className="rounded-xl border border-border bg-card p-5">
                  <UpwardProposalForm departmentId={dept.id} />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Think + Improve Mode */}
          <TabsContent value="think" className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="text-center space-y-3 py-8">
                <Brain className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                <h3 className="text-lg font-semibold text-foreground">Think + Improve Mode</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Use the Leadership AI to diagnose team issues, improve execution, refine strategy translation, and prepare structured feedback for the CEO.
                </p>
                <button
                  onClick={() => setChatOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium mt-2"
                >
                  <Bot className="h-4 w-4" />
                  Open Leadership AI
                </button>
              </div>
            </div>

            {/* Quick context for thinking */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest mb-4">Execution Snapshot</h2>
                <div className="rounded-xl border border-border bg-card p-5">
                  <ExecutionSnapshot departmentId={dept.id} />
                </div>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest mb-4">Strategy Context</h2>
                <div className="rounded-xl border border-border bg-card p-5">
                  <StrategyFeed departmentId={dept.id} />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <LeadershipAiChat open={chatOpen} onOpenChange={setChatOpen} departmentId={dept.id} />
    </div>
  );
}
