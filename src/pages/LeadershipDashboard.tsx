import { useState } from "react";
import { useParams } from "react-router-dom";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { StrategyFeed } from "@/components/StrategyFeed";
import { TranslationBlockComponent } from "@/components/TranslationBlock";
import { UpwardProposalForm } from "@/components/UpwardProposal";
import { LeadershipAiChat } from "@/components/LeadershipAiChat";
import { Bot } from "lucide-react";

export default function LeadershipDashboard() {
  const { deptId } = useParams<{ deptId: string }>();
  const { departments } = useDepartments();
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-6">
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

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 space-y-8">
        {/* Strategy Feed */}
        <div>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest mb-4">Strategy Feed</h2>
          <div className="rounded-xl border border-border bg-card p-5">
            <StrategyFeed departmentId={dept.id} />
          </div>
        </div>

        {/* Action Required (simplified from Translation Required) */}
        <div>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest mb-4">Action Required</h2>
          <div className="rounded-xl border border-border bg-card p-5">
            <TranslationBlockComponent departmentId={dept.id} />
          </div>
        </div>

        {/* Promote Upward */}
        <div>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest mb-4">Promote Upward</h2>
          <div className="rounded-xl border border-border bg-card p-5">
            <UpwardProposalForm departmentId={dept.id} />
          </div>
        </div>
      </div>

      <LeadershipAiChat open={chatOpen} onOpenChange={setChatOpen} departmentId={dept.id} />
    </div>
  );
}
