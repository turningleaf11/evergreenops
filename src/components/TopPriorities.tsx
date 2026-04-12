import { useState } from "react";
import { useCEOContext, type Priority } from "@/lib/ceo-context";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

const statusColors: Record<Priority["status"], string> = {
  active: "bg-primary/10 text-primary",
  blocked: "bg-destructive/10 text-destructive",
  done: "bg-muted text-muted-foreground line-through",
};

const statusLabels: Priority["status"][] = ["active", "blocked", "done"];

export function TopPriorities() {
  const { data, addPriority, updatePriority, removePriority } = useCEOContext();
  const [newText, setNewText] = useState("");

  const handleAdd = () => {
    if (!newText.trim()) return;
    addPriority(newText.trim());
    setNewText("");
  };

  return (
    <div className="space-y-3">
      {data.topPriorities.map((p) => (
        <div key={p.id} className="flex items-start gap-3 group">
          <button
            onClick={() => {
              const next = statusLabels[(statusLabels.indexOf(p.status) + 1) % statusLabels.length];
              updatePriority(p.id, { status: next });
            }}
            className={cn("mt-0.5 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide shrink-0 transition-colors", statusColors[p.status])}
          >
            {p.status}
          </button>
          <input
            value={p.text}
            onChange={(e) => updatePriority(p.id, { text: e.target.value })}
            className={cn("flex-1 bg-transparent text-sm text-foreground border-none outline-none", p.status === "done" && "line-through text-muted-foreground")}
          />
          <button onClick={() => removePriority(p.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {data.topPriorities.length < 5 && (
        <div className="flex items-center gap-2">
          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Add strategic priority..."
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground/50 border-none outline-none"
          />
        </div>
      )}
    </div>
  );
}
