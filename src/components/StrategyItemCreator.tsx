import { useState } from "react";
import { useStrategyFlow, StrategyItemType } from "@/lib/strategy-flow";
import { departments } from "@/lib/mock-data";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Target, ShieldAlert, Gavel, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const typeConfig: Record<StrategyItemType, { label: string; icon: React.ElementType; color: string }> = {
  objective: { label: "Objective", icon: Target, color: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
  constraint: { label: "Constraint", icon: ShieldAlert, color: "bg-amber-500/10 text-amber-700 border-amber-200" },
  decision: { label: "Decision", icon: Gavel, color: "bg-blue-500/10 text-blue-700 border-blue-200" },
};

export function StrategyItemCreator() {
  const { addStrategyItem, strategyItems, updateStrategyItem, deleteStrategyItem } = useStrategyFlow();
  const { user } = useAuth();
  const currentUserId = user?.id || "";
  const [creating, setCreating] = useState(false);
  const [type, setType] = useState<StrategyItemType>("objective");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);

  const toggleDept = (id: string) => {
    setSelectedDepts((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  };

  const handleCreate = () => {
    if (!title.trim()) return;
    addStrategyItem({
      type,
      title: title.trim(),
      description: description.trim(),
      createdBy: currentUserId,
      assignedDepartments: selectedDepts,
      status: "new",
    });
    setCreating(false);
    setTitle("");
    setDescription("");
    setSelectedDepts([]);
    toast.success("Strategy item created");
  };

  const statusColors: Record<string, string> = {
    new: "bg-blue-100 text-blue-700",
    acknowledged: "bg-amber-100 text-amber-700",
    translated: "bg-purple-100 text-purple-700",
    in_execution: "bg-emerald-100 text-emerald-700",
    resolved: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-widest">Strategy Items</h3>
        <button
          onClick={() => setCreating(!creating)}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Item
        </button>
      </div>

      {creating && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex gap-2">
            {(Object.keys(typeConfig) as StrategyItemType[]).map((t) => {
              const cfg = typeConfig[t];
              const Icon = cfg.icon;
              return (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    type === t ? cfg.color + " ring-1 ring-current/20" : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {cfg.label}
                </button>
              );
            })}
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What is the strategic item?"
            className="w-full bg-transparent text-sm font-medium border-b border-border pb-2 outline-none placeholder:text-muted-foreground/40"
            autoFocus
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the context, reasoning, and expected outcome..."
            className="w-full bg-transparent text-sm border border-border rounded-lg p-3 outline-none placeholder:text-muted-foreground/40 min-h-[80px] resize-none"
          />
          <div>
            <p className="text-xs text-muted-foreground mb-2">Assign to departments:</p>
            <div className="flex flex-wrap gap-1.5">
              {departments.map((d) => (
                <button
                  key={d.id}
                  onClick={() => toggleDept(d.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    selectedDepts.includes(d.id)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreating(false)} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!title.trim()}
              className="text-xs font-medium bg-primary text-primary-foreground px-4 py-1.5 rounded-lg disabled:opacity-40"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Existing items list */}
      <div className="space-y-2">
        {strategyItems.map((item) => {
          const cfg = typeConfig[item.type];
          const Icon = cfg.icon;
          return (
            <div key={item.id} className="rounded-lg border border-border bg-card px-4 py-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground truncate">{item.title}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="secondary" className={`text-[10px] ${statusColors[item.status]}`}>
                    {item.status.replace("_", " ")}
                  </Badge>
                  <button
                    onClick={() => deleteStrategyItem(item.id)}
                    className="text-muted-foreground/50 hover:text-destructive transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {item.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 pl-6">{item.description}</p>
              )}
              <div className="flex items-center gap-2 pl-6">
                <span className="text-[10px] text-muted-foreground">
                  {item.assignedDepartments.map((id) => departments.find((d) => d.id === id)?.name).filter(Boolean).join(", ")}
                </span>
                {item.responses.length > 0 && (
                  <span className="text-[10px] text-primary font-medium">{item.responses.length} response(s)</span>
                )}
              </div>
            </div>
          );
        })}
        {strategyItems.length === 0 && (
          <p className="text-xs text-muted-foreground/60 text-center py-4">No strategy items yet. Create one to cascade direction.</p>
        )}
      </div>
    </div>
  );
}
