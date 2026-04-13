import { useState } from "react";
import { useStrategyFlow, StrategyItem, LeadershipResponseType } from "@/lib/strategy-flow";
import { useAuth } from "@/contexts/AuthContext";
import { Target, ShieldAlert, Gavel, ChevronDown, ChevronRight, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const typeIcons: Record<string, React.ElementType> = {
  objective: Target,
  constraint: ShieldAlert,
  decision: Gavel,
};

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  acknowledged: "bg-amber-100 text-amber-700",
  translated: "bg-purple-100 text-purple-700",
  in_execution: "bg-emerald-100 text-emerald-700",
  resolved: "bg-muted text-muted-foreground",
};

interface Props {
  departmentId: string;
}

export function StrategyFeed({ departmentId }: Props) {
  const { getItemsForDepartment, addResponse, updateStrategyItem } = useStrategyFlow();
  const { user } = useAuth();
  const currentUserId = user?.id || "";
  const items = getItemsForDepartment(departmentId);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseType, setResponseType] = useState<LeadershipResponseType>("accept");
  const [form, setForm] = useState({ groundTruth: "", analysis: "", recommendation: "", expectedImpact: "" });

  const handleSubmitResponse = (item: StrategyItem) => {
    if (!form.groundTruth.trim() || !form.analysis.trim()) {
      toast.error("Ground truth and analysis are required");
      return;
    }
    addResponse({
      strategyItemId: item.id,
      departmentId,
      responderId: currentUserId,
      type: responseType,
      ...form,
    });
    setRespondingTo(null);
    setForm({ groundTruth: "", analysis: "", recommendation: "", expectedImpact: "" });
    toast.success("Response submitted");
  };

  const handleAcknowledge = (item: StrategyItem) => {
    if (item.status === "new") {
      updateStrategyItem(item.id, { status: "acknowledged" });
      toast.success("Strategy item acknowledged");
    }
  };

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground/60 text-center py-6">No strategy items assigned to this department.</p>
      )}
      {items.map((item) => {
        const Icon = typeIcons[item.type] || Target;
        const isExpanded = respondingTo === item.id;
        const deptResponse = item.responses.find((r) => r.departmentId === departmentId);
        return (
          <div key={item.id} className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground">{item.title}</span>
                </div>
                <Badge variant="secondary" className={`text-[10px] shrink-0 ${statusColors[item.status]}`}>
                  {item.status.replace("_", " ")}
                </Badge>
              </div>
              {item.description && (
                <p className="text-xs text-muted-foreground pl-6">{item.description}</p>
              )}
              <div className="flex items-center gap-2 pl-6 pt-1">
                {item.status === "new" && (
                  <button
                    onClick={() => handleAcknowledge(item)}
                    className="text-xs font-medium text-primary hover:text-primary/80"
                  >
                    Acknowledge
                  </button>
                )}
                {!deptResponse && (
                  <button
                    onClick={() => setRespondingTo(isExpanded ? null : item.id)}
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    Respond to Strategy
                  </button>
                )}
                {deptResponse && (
                  <span className="text-[10px] text-emerald-600 font-medium">✓ Responded ({deptResponse.type})</span>
                )}
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-border px-4 py-4 bg-muted/30 space-y-3">
                <div className="flex gap-2">
                  {(["accept", "refine", "challenge"] as LeadershipResponseType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setResponseType(t)}
                      className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                        responseType === t
                          ? t === "accept" ? "bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-300"
                          : t === "refine" ? "bg-amber-500/10 text-amber-700 ring-1 ring-amber-300"
                          : "bg-red-500/10 text-red-700 ring-1 ring-red-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide">What I'm seeing on the ground *</label>
                    <textarea
                      value={form.groundTruth}
                      onChange={(e) => setForm({ ...form, groundTruth: e.target.value })}
                      className="w-full text-xs bg-background border border-border rounded-md p-2 mt-1 outline-none resize-none min-h-[60px]"
                      placeholder="What is actually happening in your department..."
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide">What I believe is actually happening *</label>
                    <textarea
                      value={form.analysis}
                      onChange={(e) => setForm({ ...form, analysis: e.target.value })}
                      className="w-full text-xs bg-background border border-border rounded-md p-2 mt-1 outline-none resize-none min-h-[60px]"
                      placeholder="Your analysis of the situation..."
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Recommended change or approach</label>
                    <textarea
                      value={form.recommendation}
                      onChange={(e) => setForm({ ...form, recommendation: e.target.value })}
                      className="w-full text-xs bg-background border border-border rounded-md p-2 mt-1 outline-none resize-none min-h-[40px]"
                      placeholder="What you'd recommend..."
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Expected impact</label>
                    <textarea
                      value={form.expectedImpact}
                      onChange={(e) => setForm({ ...form, expectedImpact: e.target.value })}
                      className="w-full text-xs bg-background border border-border rounded-md p-2 mt-1 outline-none resize-none min-h-[40px]"
                      placeholder="What will change if this is adopted..."
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => handleSubmitResponse(item)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground"
                  >
                    <Send className="h-3 w-3" /> Submit Response
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
