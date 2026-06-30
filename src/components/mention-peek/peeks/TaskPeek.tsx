import { useEffect, useState, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, User, CheckSquare, Loader2, ChevronDown, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ActivityPanel from "@/components/activity/ActivityPanel";
import RichTextEditor from "@/components/RichTextEditor";
import { StatusPill, PriorityPill } from "@/components/primitives";

interface Subtask { id: string; title: string; done: boolean; }

interface Props { id: string; open: boolean; onClose: () => void; }

export default function TaskPeek({ id, open, onClose }: Props) {
  const [row, setRow] = useState<any>(null);
  const [assigneeName, setAssigneeName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [newSubtask, setNewSubtask] = useState("");
  const [subtasksOpen, setSubtasksOpen] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
    if (data && !Array.isArray(data.subtasks)) data.subtasks = [];
    setRow(data);
    const assigneeId = data?.assigned_to;
    if (assigneeId) {
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("user_id", assigneeId).maybeSingle();
      setAssigneeName(prof?.full_name || "");
    } else {
      setAssigneeName("");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { if (open && id) load(); }, [open, id, load]);

  const updateStatus = async (status: string) => {
    if (!row) return;
    const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else setRow({ ...row, status });
  };

  const updatePriority = async (priority: string) => {
    if (!row) return;
    const { error } = await supabase.from("tasks").update({ priority }).eq("id", id);
    if (error) toast.error(error.message);
    else setRow({ ...row, priority });
  };

  const updateTask = async (updates: Record<string, any>) => {
    if (!row) return;
    const { error } = await supabase.from("tasks").update(updates).eq("id", id);
    if (error) toast.error(error.message);
    else setRow({ ...row, ...updates });
  };

  const subtasks: Subtask[] = row?.subtasks || [];
  const doneSubtasks = subtasks.filter((s) => s.done).length;

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    updateTask({ subtasks: [...subtasks, { id: crypto.randomUUID(), title: newSubtask.trim(), done: false }] });
    setNewSubtask("");
  };

  const toggleSubtask = (stId: string) => {
    updateTask({ subtasks: subtasks.map((s) => (s.id === stId ? { ...s, done: !s.done } : s)) });
  };

  const removeSubtask = (stId: string) => {
    updateTask({ subtasks: subtasks.filter((s) => s.id !== stId) });
  };

  const title = row?.title || "Untitled task";
  const status = row?.status || "todo";
  const priority = row?.priority;
  const dueDate = row?.due_date;
  const description = row?.description;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[1100px] p-0 overflow-hidden flex flex-col">
        {loading || !row ? (
          <div className="flex items-center gap-2 px-6 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading task…
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left main column */}
            <div className="flex-1 min-w-0 flex flex-col overflow-y-auto">
              {/* Header */}
              <div className="px-6 py-5 border-b border-border/40 shrink-0 space-y-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckSquare className="h-3.5 w-3.5 text-primary/70" />
                  <span className="font-medium">Task</span>
                </div>

                <SheetHeader>
                  <SheetTitle className="text-xl text-left">{title}</SheetTitle>
                </SheetHeader>

                <div className="flex items-center gap-2 flex-wrap">
                  <StatusPill kind="task" value={status} onChange={updateStatus} />
                  {priority && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <PriorityPill value={priority} size="sm" onChange={updatePriority} />
                    </>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-4">
                <div className="space-y-2">
                  {assigneeName && (
                    <div className="flex items-center gap-3 text-sm">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{assigneeName}</span>
                    </div>
                  )}
                  {dueDate && (
                    <div className="flex items-center gap-3 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{dueDate}</span>
                    </div>
                  )}
                </div>

                {description && (
                  <div className="pt-3 border-t border-border/40">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Description</p>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap">{description}</p>
                  </div>
                )}

                <div className="pt-3 border-t border-border/40">
                  <RichTextEditor
                    content={row.notes_content || ""}
                    onChange={(html) => updateTask({ notes_content: html })}
                    placeholder="Write notes, plans, context…"
                    borderless
                  />
                </div>

                <Collapsible open={subtasksOpen} onOpenChange={setSubtasksOpen} className="pt-1 border-t border-border/40">
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground w-full py-2">
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${subtasksOpen ? "" : "-rotate-90"}`} />
                    <CheckSquare className="h-3.5 w-3.5" />
                    Subtasks {subtasks.length > 0 && <span className="text-xs font-normal">({doneSubtasks}/{subtasks.length})</span>}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1.5 pt-1">
                    {subtasks.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-accent/30 group">
                        <Checkbox checked={s.done} onCheckedChange={() => toggleSubtask(s.id)} />
                        <span className={`text-sm flex-1 ${s.done ? "line-through text-muted-foreground" : ""}`}>{s.title}</span>
                        <button className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity" onClick={() => removeSubtask(s.id)}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <Input
                        value={newSubtask}
                        onChange={(e) => setNewSubtask(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addSubtask()}
                        placeholder="Add a subtask…"
                        className="text-sm h-8 border-dashed"
                      />
                      <Button size="sm" variant="ghost" onClick={addSubtask} disabled={!newSubtask.trim()}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>

            {/* Right rail — Activity */}
            <aside className="w-[400px] shrink-0 border-l border-border/40 bg-card/30 flex flex-col overflow-hidden">
              <div className="px-4 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground shrink-0 border-b border-border/40">
                Activity · Comments
              </div>
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col px-2 py-2">
                <ActivityPanel entityType="task" entityId={id} hideHeader />
              </div>
            </aside>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
