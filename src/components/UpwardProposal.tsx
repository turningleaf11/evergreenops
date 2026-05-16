import { useState } from "react";
import { useStrategyFlow, UpwardProposalType } from "@/lib/strategy-flow";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowUp, AlertTriangle, HelpCircle, Flag, Send } from "lucide-react";
import { toast } from "sonner";

const sb = supabase as any;

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
  const { user } = useAuth();
  const currentUserId = user?.id || "";
  const [selectedType, setSelectedType] = useState<UpwardProposalType | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async () => {
    if (!selectedType || !title.trim() || !message.trim()) {
      toast.error("Add a title and a short message");
      return;
    }
    const proposalTitle = title.trim();
    await addProposal({
      type: selectedType,
      departmentId,
      createdBy: currentUserId,
      title: proposalTitle,
      reasoning: message.trim(),
      recommendation: "",
      status: "pending",
    });

    // Notify all primary admins (CEO) so this surfaces in their inbox
    try {
      const { data: ceos } = await sb
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .eq("is_primary", true);
      const { data: actorProf } = await sb
        .from("profiles")
        .select("full_name")
        .eq("user_id", currentUserId)
        .maybeSingle();
      const actorName = (actorProf as any)?.full_name || "A leader";
      const rows = (ceos ?? [])
        .map((r: any) => r.user_id)
        .filter((uid: string) => uid && uid !== currentUserId)
        .map((uid: string) => ({
          user_id: uid,
          actor_id: currentUserId,
          actor_name: actorName,
          type: "upward_proposal",
          entity_type: "upward_proposal",
          entity_id: null,
          body: `sent a proposal for review: "${proposalTitle}"`,
          url: "/ceo?tab=delegation",
        }));
      if (rows.length > 0) await sb.from("notifications").insert(rows);
    } catch (e) {
      console.warn("proposal notification fan-out failed:", e);
    }

    setSelectedType(null);
    setTitle("");
    setMessage("");
    toast.success("Sent to CEO");
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
            placeholder="Title — what is this about?"
            className="w-full text-sm font-medium bg-transparent border-b border-border pb-2 outline-none placeholder:text-muted-foreground/40"
            autoFocus
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full text-sm bg-transparent outline-none resize-none min-h-[120px] placeholder:text-muted-foreground/40"
            placeholder="Write a short note for the CEO. What's going on, and what would you like from them?"
          />
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
