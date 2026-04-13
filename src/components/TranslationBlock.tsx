import { useState } from "react";
import { useStrategyFlow, StrategyItem } from "@/lib/strategy-flow";
import { Target, ShieldAlert, Gavel, Plus, X } from "lucide-react";
import { toast } from "sonner";

const typeIcons: Record<string, React.ElementType> = {
  objective: Target,
  constraint: ShieldAlert,
  decision: Gavel,
};

interface Props {
  departmentId: string;
}

export function TranslationBlockComponent({ departmentId }: Props) {
  const { getItemsForDepartment, getTranslationsForItem, addTranslation } = useStrategyFlow();
  const items = getItemsForDepartment(departmentId).filter(
    (i) => i.status === "acknowledged" || i.status === "new"
  );

  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [meaning, setMeaning] = useState("");
  const [immediateChanges, setImmediateChanges] = useState("");
  const [priorities, setPriorities] = useState<string[]>([""]);
  const [actions, setActions] = useState<string[]>([""]);

  const handleSubmit = (itemId: string) => {
    if (!meaning.trim()) {
      toast.error("Define what this means for your department");
      return;
    }
    addTranslation({
      strategyItemId: itemId,
      departmentId,
      meaning: meaning.trim(),
      immediateChanges: immediateChanges.trim(),
      priorities: priorities.filter((p) => p.trim()),
      actions: actions.filter((a) => a.trim()),
    });
    setTranslatingId(null);
    resetForm();
    toast.success("Translation submitted — item moved to execution");
  };

  const resetForm = () => {
    setMeaning("");
    setImmediateChanges("");
    setPriorities([""]);
    setActions([""]);
  };

  const untranslated = items.filter((i) => !getTranslationsForItem(i.id, departmentId));

  if (untranslated.length === 0) {
    return (
      <div className="text-xs text-muted-foreground/60 text-center py-6">
        All assigned strategy items have been translated.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
        {untranslated.length} item(s) need translation before execution
      </p>
      {untranslated.map((item) => {
        const Icon = typeIcons[item.type] || Target;
        const isActive = translatingId === item.id;
        return (
          <div key={item.id} className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/10 overflow-hidden">
            <button
              onClick={() => { setTranslatingId(isActive ? null : item.id); resetForm(); }}
              className="w-full px-4 py-3 flex items-center gap-2 text-left"
            >
              <Icon className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-sm font-medium text-foreground">{item.title}</span>
            </button>
            {isActive && (
              <div className="border-t border-amber-200 px-4 py-4 space-y-3 bg-background">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide">What this means for our department *</label>
                  <textarea
                    value={meaning}
                    onChange={(e) => setMeaning(e.target.value)}
                    className="w-full text-xs border border-border rounded-md p-2 mt-1 outline-none resize-none min-h-[60px] bg-background"
                    placeholder="Translate this strategy item into department-specific terms..."
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide">What changes immediately</label>
                  <textarea
                    value={immediateChanges}
                    onChange={(e) => setImmediateChanges(e.target.value)}
                    className="w-full text-xs border border-border rounded-md p-2 mt-1 outline-none resize-none min-h-[40px] bg-background"
                    placeholder="Immediate operational changes..."
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Top 1-2 priorities</label>
                  {priorities.map((p, i) => (
                    <div key={i} className="flex gap-1 mt-1">
                      <input
                        value={p}
                        onChange={(e) => {
                          const next = [...priorities];
                          next[i] = e.target.value;
                          setPriorities(next);
                        }}
                        className="flex-1 text-xs border border-border rounded-md px-2 py-1.5 outline-none bg-background"
                        placeholder={`Priority ${i + 1}`}
                      />
                      {priorities.length > 1 && (
                        <button onClick={() => setPriorities(priorities.filter((_, j) => j !== i))} className="text-muted-foreground/50 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {priorities.length < 2 && (
                    <button onClick={() => setPriorities([...priorities, ""])} className="text-[10px] text-primary mt-1 flex items-center gap-0.5">
                      <Plus className="h-3 w-3" /> Add priority
                    </button>
                  )}
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Actions to implement</label>
                  {actions.map((a, i) => (
                    <div key={i} className="flex gap-1 mt-1">
                      <input
                        value={a}
                        onChange={(e) => {
                          const next = [...actions];
                          next[i] = e.target.value;
                          setActions(next);
                        }}
                        className="flex-1 text-xs border border-border rounded-md px-2 py-1.5 outline-none bg-background"
                        placeholder={`Action ${i + 1}`}
                      />
                      {actions.length > 1 && (
                        <button onClick={() => setActions(actions.filter((_, j) => j !== i))} className="text-muted-foreground/50 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setActions([...actions, ""])} className="text-[10px] text-primary mt-1 flex items-center gap-0.5">
                    <Plus className="h-3 w-3" /> Add action
                  </button>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => handleSubmit(item.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground"
                  >
                    Submit Translation
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
