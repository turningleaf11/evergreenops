import { useState } from "react";
import { useStrategyFlow } from "@/lib/strategy-flow";
import { departments } from "@/lib/mock-data";
import { Check, X, MessageCircle, ArrowUp, AlertTriangle, HelpCircle, Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const proposalTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  strategy_change: { label: "Strategy Change", icon: ArrowUp, color: "text-blue-600" },
  escalate_constraint: { label: "Escalation", icon: AlertTriangle, color: "text-amber-600" },
  request_decision: { label: "Decision Request", icon: HelpCircle, color: "text-purple-600" },
  flag_misalignment: { label: "Misalignment", icon: Flag, color: "text-red-600" },
};

export function CeoReviewFeed() {
  const { proposals, updateProposal, strategyItems } = useStrategyFlow();
  const [clarificationText, setClarificationText] = useState<Record<string, string>>({});
  const [showClarification, setShowClarification] = useState<string | null>(null);

  const pendingProposals = proposals.filter((p) => p.status === "pending");
  const resolvedProposals = proposals.filter((p) => p.status !== "pending");

  const handleAccept = (id: string) => {
    updateProposal(id, { status: "accepted", ceoResponse: "Accepted" });
    toast.success("Proposal accepted");
  };

  const handleReject = (id: string) => {
    updateProposal(id, { status: "rejected", ceoResponse: "Rejected" });
    toast("Proposal rejected");
  };

  const handleClarify = (id: string) => {
    const text = clarificationText[id];
    if (!text?.trim()) return;
    updateProposal(id, { status: "clarification_needed", ceoResponse: text.trim() });
    setShowClarification(null);
    setClarificationText((prev) => ({ ...prev, [id]: "" }));
    toast("Clarification requested");
  };

  // Also show leadership responses to strategy items (challenges/refinements)
  const itemsWithResponses = strategyItems.filter((si) => si.responses.length > 0);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-widest">Leadership Review Queue</h3>

      {pendingProposals.length === 0 && itemsWithResponses.length === 0 && (
        <p className="text-xs text-muted-foreground/60 text-center py-4">No items requiring review.</p>
      )}

      {/* Upward Proposals */}
      {pendingProposals.map((proposal) => {
        const cfg = proposalTypeConfig[proposal.type];
        const Icon = cfg.icon;
        const dept = departments.find((d) => d.id === proposal.departmentId);
        return (
          <div key={proposal.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${cfg.color}`} />
                <span className="text-sm font-medium text-foreground">{proposal.title}</span>
              </div>
              <Badge variant="outline" className="text-[10px]">{dept?.name}</Badge>
            </div>
            <div className="space-y-2 pl-6">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Reasoning</p>
                <p className="text-xs text-foreground">{proposal.reasoning}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Recommendation</p>
                <p className="text-xs text-foreground">{proposal.recommendation}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 pl-6 pt-1">
              <button onClick={() => handleAccept(proposal.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 transition-colors">
                <Check className="h-3 w-3" /> Accept
              </button>
              <button onClick={() => handleReject(proposal.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-red-500/10 text-red-700 hover:bg-red-500/20 transition-colors">
                <X className="h-3 w-3" /> Reject
              </button>
              <button onClick={() => setShowClarification(showClarification === proposal.id ? null : proposal.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                <MessageCircle className="h-3 w-3" /> Clarify
              </button>
            </div>
            {showClarification === proposal.id && (
              <div className="pl-6 flex gap-2">
                <input
                  value={clarificationText[proposal.id] || ""}
                  onChange={(e) => setClarificationText((prev) => ({ ...prev, [proposal.id]: e.target.value }))}
                  placeholder="What do you need clarified?"
                  className="flex-1 text-xs bg-muted rounded-md px-3 py-1.5 outline-none"
                  onKeyDown={(e) => e.key === "Enter" && handleClarify(proposal.id)}
                />
                <button onClick={() => handleClarify(proposal.id)} className="text-xs text-primary font-medium">Send</button>
              </div>
            )}
          </div>
        );
      })}

      {/* Strategy item responses (challenges/refinements) */}
      {itemsWithResponses.map((item) =>
        item.responses.map((response) => {
          const dept = departments.find((d) => d.id === response.departmentId);
          const typeColor = response.type === "challenge" ? "text-red-600" : response.type === "refine" ? "text-amber-600" : "text-emerald-600";
          return (
            <div key={response.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold capitalize ${typeColor}`}>{response.type}</span>
                  <span className="text-xs text-muted-foreground">on "{item.title}"</span>
                </div>
                <Badge variant="outline" className="text-[10px]">{dept?.name}</Badge>
              </div>
              <p className="text-xs text-foreground pl-2"><span className="text-muted-foreground">Ground truth:</span> {response.groundTruth}</p>
              <p className="text-xs text-foreground pl-2"><span className="text-muted-foreground">Analysis:</span> {response.analysis}</p>
              <p className="text-xs text-foreground pl-2"><span className="text-muted-foreground">Recommendation:</span> {response.recommendation}</p>
              <p className="text-xs text-foreground pl-2"><span className="text-muted-foreground">Expected impact:</span> {response.expectedImpact}</p>
            </div>
          );
        })
      )}

      {/* Resolved proposals */}
      {resolvedProposals.length > 0 && (
        <div className="pt-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Resolved</p>
          {resolvedProposals.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-xs text-muted-foreground py-1.5 border-b border-border/50 last:border-0">
              <span>{p.title}</span>
              <Badge variant="secondary" className={`text-[10px] ${
                p.status === "accepted" ? "bg-emerald-100 text-emerald-700" :
                p.status === "rejected" ? "bg-red-100 text-red-700" :
                "bg-amber-100 text-amber-700"
              }`}>
                {p.status.replace("_", " ")}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
