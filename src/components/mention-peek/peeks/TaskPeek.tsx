import { useEffect, useState, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar, User, CheckSquare, Loader2, Plus, X, Paperclip } from "lucide-react";
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
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
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

                <div className="space-y-1.5">
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
              </div>

              {/* Tabs — Overview / Subtasks / Notes / Attachments. Each tab
                  scrolls independently so the rich-text editor can never
                  push subtasks out of view. */}
              <Tabs defaultValue="overview" className="flex-1 min-h-0 flex flex-col">
                <TabsList className="shrink-0 w-full justify-start rounded-none border-b border-border/40 bg-transparent px-6 gap-1 h-9">
                  <TabsTrigger value="overview" className="text-xs data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-1 h-full">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="subtasks" className="text-xs data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-1 h-full">
                    Subtasks {subtasks.length > 0 && <span className="ml-1 text-muted-foreground">({doneSubtasks}/{subtasks.length})</span>}
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="text-xs data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-1 h-full">
                    Notes
                  </TabsTrigger>
                  <TabsTrigger value="attachments" className="text-xs data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-1 h-full">
                    Attachments
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="flex-1 min-h-0 overflow-y-auto mt-0 px-6 py-5 space-y-4">
                  {description ? (
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap">{description}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No description.</p>
                  )}
                </TabsContent>

                <TabsContent value="subtasks" className="flex-1 min-h-0 overflow-y-auto mt-0 px-6 py-5 space-y-1.5">
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
                </TabsContent>

                <TabsContent value="notes" className="flex-1 min-h-0 overflow-y-auto mt-0 px-6 py-5">
                  <RichTextEditor
                    content={row.notes_content || ""}
                    onChange={(html) => updateTask({ notes_content: html })}
                    placeholder="Write notes, plans, context…"
                    borderless
                    showToolbar
                    minHeight="280px"
                  />
                </TabsContent>

                <TabsContent value="attachments" className="flex-1 min-h-0 overflow-y-auto mt-0 px-6 py-5">
                  <div className="flex flex-col items-center justify-center text-center py-10 text-sm text-muted-foreground">
                    <Paperclip className="h-5 w-5 mb-2 text-muted-foreground/60" />
                    <p>No attachments yet.</p>
                    <p className="text-xs mt-1">Attachments aren't built yet — placeholder for the upcoming pattern.</p>
                  </div>
                </TabsContent>
              </Tabs>
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
