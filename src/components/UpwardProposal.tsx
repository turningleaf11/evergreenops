import { useState } from "react";
import { useStrategyFlow, UpwardProposalType } from "@/lib/strategy-flow";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowUp, AlertTriangle, HelpCircle, Flag, Send } from "lucide-react";
import { toast } from "sonner";

const proposalTypes: { type: UpwardProposalType; label: string; icon: React.ElementType; desc: string }[] = [
  { type: "strategy_change", label: "Propose Strategy Change", icon: ArrowUp, desc: "Suggest a change in direction based on what you're seeing" },
  { type: "escalate_constraint", label: "Escalate Constraint", icon: AlertTriangle, desc: "Flag a constraint that's blocking execution" },
  { type: "request_decision", label: "Request Decision", icon: HelpCircle, desc: "Need a CEO-level decision to proceed" },
  { type: "flag_misalignment", label: "Flag Misalignment", icon: Flag, desc: "Something isn't aligned between strategy and execution" },
];

interface Props {
  departmentId: string;
}

export function UpwardProposalForm({ departmentId }: Props) {
  const { addProposal, proposals } = useStrategyFlow();
  const { currentUserId } = useAuth();
  const [selectedType, setSelectedType] = useState<UpwardProposalType | null>(null);
  const [title, setTitle] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [recommendation, setRecommendation] = useState("");

  const handleSubmit = () => {
    if (!selectedType || !title.trim() || !reasoning.trim() || !recommendation.trim()) {
      toast.error("All fields are required");
      return;
    }
    addProposal({
      type: selectedType,
      departmentId,
      createdBy: currentUserId,
      title: title.trim(),
      reasoning: reasoning.trim(),
      recommendation: recommendation.trim(),
      status: "pending",
    });
    setSelectedType(null);
    setTitle("");
    setReasoning("");
    setRecommendation("");
    toast.success("Proposal sent to CEO for review");
  };

  const deptProposals = proposals.filter((p) => p.departmentId === departmentId);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {proposalTypes.map(({ type, label, icon: Icon, desc }) => (
          <button
            key={type}
            onClick={() => setSelectedType(selectedType === type ? null : type)}
            className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${
              selectedType === type
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : "border-border bg-card hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">{label}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">{desc}</p>
          </button>
        ))}
      </div>

      {selectedType && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What is this about?"
            className="w-full text-sm font-medium bg-transparent border-b border-border pb-2 outline-none placeholder:text-muted-foreground/40"
            autoFocus
          />
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Reasoning *</label>
            <textarea
              value={reasoning}
              onChange={(e) => setReasoning(e.target.value)}
              className="w-full text-xs border border-border rounded-md p-2 mt-1 outline-none resize-none min-h-[60px] bg-background"
              placeholder="What are you seeing and why does this matter?"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Recommendation *</label>
            <textarea
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              className="w-full text-xs border border-border rounded-md p-2 mt-1 outline-none resize-none min-h-[60px] bg-background"
              placeholder="What do you recommend and what's the expected impact?"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setSelectedType(null)} className="text-xs text-muted-foreground px-3 py-1.5">Cancel</button>
            <button
              onClick={handleSubmit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground"
            >
              <Send className="h-3 w-3" /> Send to CEO
            </button>
          </div>
        </div>
      )}

      {/* Previous proposals */}
      {deptProposals.length > 0 && (
        <div className="pt-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Submitted Proposals</p>
          <div className="space-y-1.5">
            {deptProposals.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0">
                <span className="text-foreground">{p.title}</span>
                <span className={`text-[10px] font-medium capitalize ${
                  p.status === "accepted" ? "text-emerald-600" :
                  p.status === "rejected" ? "text-red-600" :
                  p.status === "clarification_needed" ? "text-amber-600" :
                  "text-muted-foreground"
                }`}>
                  {p.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
