import { useState } from "react";
import { useStrategyFlow, StrategyItem } from "@/lib/strategy-flow";
import { Target, ShieldAlert, Gavel, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

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

  const [activeId, setActiveId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const handleAcknowledge = (itemId: string) => {
    addTranslation({
      strategyItemId: itemId,
      departmentId,
      meaning: notes.trim() || "Acknowledged — team is aligned.",
      immediateChanges: "",
      priorities: [],
      actions: [],
    });
    setActiveId(null);
    setNotes("");
    toast.success("Acknowledged — item moved to execution");
  };

  const untranslated = items.filter((i) => !getTranslationsForItem(i.id, departmentId));

  if (untranslated.length === 0) {
    return (
      <div className="text-xs text-muted-foreground/60 text-center py-6">
        All caught up — no items need your response.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Review these directives from leadership and acknowledge when your team is aligned.
      </p>
      {untranslated.map((item) => {
        const Icon = typeIcons[item.type] || Target;
        const isActive = activeId === item.id;
        return (
          <div key={item.id} className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/10 overflow-hidden">
            <button
              onClick={() => { setActiveId(isActive ? null : item.id); setNotes(""); }}
              className="w-full px-4 py-3 flex items-center gap-2 text-left"
            >
              <Icon className="h-4 w-4 text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground">{item.title}</span>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                )}
              </div>
            </button>
            {isActive && (
              <div className="border-t border-amber-200 px-4 py-4 space-y-3 bg-background">
                <div>
                  <label className="text-xs text-muted-foreground">
                    Department notes <span className="text-muted-foreground/50">(optional)</span>
                  </label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 min-h-[60px] text-sm"
                    placeholder="Any notes, concerns, or context for your team..."
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => handleAcknowledge(item.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Acknowledge
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
