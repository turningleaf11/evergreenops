import { useState } from "react";
import { useCEOContext } from "@/lib/ceo-context";
import { Plus, X } from "lucide-react";

export function DecisionLog() {
  const { data, addDecision, updateDecision, removeDecision } = useCEOContext();
  const [newText, setNewText] = useState("");

  const handleAdd = () => {
    if (!newText.trim()) return;
    addDecision(newText.trim());
    setNewText("");
  };

  return (
    <div className="space-y-3">
      {/* Add new */}
      <div className="flex items-center gap-2 pb-3 border-b border-border">
        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Log a decision..."
          className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground/50 border-none outline-none"
        />
      </div>

      {/* Decisions list */}
      {data.recentDecisions.length === 0 && (
        <p className="text-sm text-muted-foreground italic">No decisions logged yet.</p>
      )}

      {data.recentDecisions.map((d) => (
        <div key={d.id} className="group space-y-1">
          <div className="flex items-start gap-2">
            <span className="text-[10px] text-muted-foreground font-mono mt-1 shrink-0">{d.date}</span>
            <input
              value={d.text}
              onChange={(e) => updateDecision(d.id, { text: e.target.value })}
              className="flex-1 bg-transparent text-sm text-foreground border-none outline-none"
            />
            <button onClick={() => removeDecision(d.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <input
            value={d.outcome || ""}
            onChange={(e) => updateDecision(d.id, { outcome: e.target.value })}
            placeholder="Outcome..."
            className="ml-[4.5rem] bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/40 border-none outline-none w-full"
          />
        </div>
      ))}
    </div>
  );
}
