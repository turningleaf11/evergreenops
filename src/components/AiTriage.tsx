import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

export type TriageItem = {
  id: string;
  text: string;
  category: "task" | "decision" | "idea" | "delegation" | "project";
  suggested_assignee_id: string | null;
  suggested_priority: string;
  reasoning: string;
};

interface AiTriageProps {
  items: TriageItem[];
  profiles: { user_id: string; full_name: string | null }[];
  onItemProcessed: (id: string) => void;
  onClear: () => void;
}

const categoryColors: Record<string, string> = {
  task: "bg-blue-500/10 text-blue-700 border-blue-200",
  decision: "bg-amber-500/10 text-amber-700 border-amber-200",
  idea: "bg-purple-500/10 text-purple-700 border-purple-200",
  delegation: "bg-green-500/10 text-green-700 border-green-200",
  project: "bg-indigo-500/10 text-indigo-700 border-indigo-200",
};

const categoryDestinations: Record<string, { label: string; path: string; tab?: string }> = {
  task: { label: "Execution", path: "/execution" },
  delegation: { label: "Execution", path: "/execution" },
  project: { label: "Execution → Projects", path: "/execution" },
  decision: { label: "Strategy → Decision Log", path: "/ceo", tab: "strategy" },
  idea: { label: "CEO Cockpit → Ideas", path: "/ceo", tab: "ideas" },
};

export function AiTriage({ items, profiles, onItemProcessed, onClear }: AiTriageProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [assignees, setAssignees] = useState<Record<string, string | null>>({});
  const [open, setOpen] = useState(true);

  if (items.length === 0) return null;

  const getAssignee = (item: TriageItem) =>
    assignees[item.id] !== undefined ? assignees[item.id] : item.suggested_assignee_id;

  const removePending = async (id: string) => {
    await supabase.from("ceo_triage_pending").delete().eq("id", id);
    onItemProcessed(id);
  };

  const approveItem = async (item: TriageItem) => {
    const assigneeId = getAssignee(item);
    const text = editingId === item.id ? editText : item.text;
    const dest = categoryDestinations[item.category];

    try {
      if (item.category === "task" || item.category === "delegation") {
        await supabase.from("tasks").insert({
          title: text,
          assigned_to: assigneeId,
          created_by: user?.id,
          priority: item.suggested_priority || "medium",
          status: "todo",
        });
      } else if (item.category === "project") {
        await supabase.from("projects").insert({
          title: text,
          created_by: user?.id,
          owner_id: assigneeId || user?.id,
          status: "not_started",
          priority: item.suggested_priority || "medium",
        });
      } else if (item.category === "decision") {
        await supabase.from("decision_log").insert({ title: text, created_by: user?.id });
      } else if (item.category === "idea") {
        await supabase.from("ideas").insert({
          title: text,
          created_by: user?.id,
          status: "captured",
          source_triage_id: item.id,
        });
      }
      toast({
        title: `${item.category.charAt(0).toUpperCase() + item.category.slice(1)} created`,
        description: `Added to ${dest.label}. ${text.slice(0, 50)}`,
        action: (
          <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={() => navigate(dest.path)}>
            View
          </Button>
        ),
      });
      await removePending(item.id);
      setEditingId(null);
    } catch {
      toast({ title: "Error creating item", variant: "destructive" });
    }
  };

  const dismissAll = async () => {
    if (!user) return;
    const ids = items.map((i) => i.id);
    if (ids.length > 0) {
      await supabase.from("ceo_triage_pending").delete().in("id", ids);
    }
    onClear();
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">
          AI Triage Queue
        </h2>
        <Badge variant="secondary" className="ml-2 text-xs">{items.length}</Badge>
        <Button variant="ghost" size="sm" className="ml-auto text-xs text-muted-foreground" onClick={(e) => { e.stopPropagation(); dismissAll(); }}>
          Dismiss All
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 space-y-2">
        {items.map((item) => {
          const dest = categoryDestinations[item.category];
          return (
            <div key={item.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${categoryColors[item.category]}`}>
                      {item.category}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {item.suggested_priority} priority
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">
                      → {dest.label}
                    </span>
                  </div>
                  {editingId === item.id ? (
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
                    if (editingId === item.id) { setEditingId(null); }
                    else { setEditingId(item.id); setEditText(item.text); }
                  }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700" onClick={() => approveItem(item)}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removePending(item.id)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {(item.category === "task" || item.category === "delegation") && (
                <Select
                  value={getAssignee(item) || "unassigned"}
                  onValueChange={(v) => setAssignees(prev => ({ ...prev, [item.id]: v === "unassigned" ? null : v }))}
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
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
