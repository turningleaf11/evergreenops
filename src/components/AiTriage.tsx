import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

export type TriageItem = {
  text: string;
  category: "task" | "decision" | "idea" | "delegation";
  suggested_assignee_id: string | null;
  suggested_priority: string;
  reasoning: string;
};

interface AiTriageProps {
  items: TriageItem[];
  profiles: { user_id: string; full_name: string | null }[];
  onItemProcessed: (index: number) => void;
  onClear: () => void;
}

const categoryColors: Record<string, string> = {
  task: "bg-blue-500/10 text-blue-700 border-blue-200",
  decision: "bg-amber-500/10 text-amber-700 border-amber-200",
  idea: "bg-purple-500/10 text-purple-700 border-purple-200",
  delegation: "bg-green-500/10 text-green-700 border-green-200",
};

export function AiTriage({ items, profiles, onItemProcessed, onClear }: AiTriageProps) {
  const { user } = useAuth();
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [assignees, setAssignees] = useState<Record<number, string | null>>({});
  const [open, setOpen] = useState(true);

  if (items.length === 0) return null;

  const getAssignee = (idx: number, item: TriageItem) => assignees[idx] ?? item.suggested_assignee_id;

  const approveItem = async (idx: number, item: TriageItem) => {
    const assigneeId = getAssignee(idx, item);
    const text = editingIdx === idx ? editText : item.text;

    try {
      if (item.category === "task" || item.category === "delegation") {
        await supabase.from("tasks").insert({
          title: text,
          assigned_to: assigneeId,
          created_by: user?.id,
          priority: item.suggested_priority || "medium",
          status: "todo",
        });
      } else if (item.category === "decision") {
        await supabase.from("decision_log").insert({
          title: text,
          created_by: user?.id,
        });
      } else if (item.category === "idea") {
        await supabase.from("strategy_items").insert({
          title: text,
          type: "idea",
          created_by: user?.id,
        });
      }
      toast({ title: `${item.category} created`, description: text.slice(0, 60) });
      onItemProcessed(idx);
      setEditingIdx(null);
    } catch {
      toast({ title: "Error creating item", variant: "destructive" });
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">
          AI Triage Results
        </h2>
        <Badge variant="secondary" className="ml-2 text-xs">{items.length}</Badge>
        <Button variant="ghost" size="sm" className="ml-auto text-xs text-muted-foreground" onClick={(e) => { e.stopPropagation(); onClear(); }}>
          Dismiss All
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="rounded-lg border border-border bg-card p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${categoryColors[item.category]}`}>
                    {item.category}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {item.suggested_priority} priority
                  </span>
                </div>
                {editingIdx === idx ? (
                  <input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full bg-transparent text-sm border-b border-border outline-none py-1"
                    autoFocus
                  />
                ) : (
                  <p className="text-sm text-foreground">{item.text}</p>
                )}
                <p className="text-xs text-muted-foreground italic">{item.reasoning}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                  if (editingIdx === idx) { setEditingIdx(null); }
                  else { setEditingIdx(idx); setEditText(item.text); }
                }}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700" onClick={() => approveItem(idx, item)}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onItemProcessed(idx)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {/* Assignee selector */}
            {(item.category === "task" || item.category === "delegation") && (
              <Select
                value={getAssignee(idx, item) || "unassigned"}
                onValueChange={(v) => setAssignees(prev => ({ ...prev, [idx]: v === "unassigned" ? null : v }))}
              >
                <SelectTrigger className="h-7 w-48 text-xs">
                  <SelectValue placeholder="Assign to..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {profiles.map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Unnamed"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
