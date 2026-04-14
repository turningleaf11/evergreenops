import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, CheckSquare, FolderKanban, AlarmClock, FileText, StickyNote, CalendarIcon, User, Building2, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";

type CreateType = "task" | "project" | "reminder" | null;

const priorityOptions = [
  { value: "high", label: "High", className: "bg-destructive/10 text-destructive border-destructive/20" },
  { value: "medium", label: "Med", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  { value: "low", label: "Low", className: "bg-muted text-muted-foreground border-border" },
];

export function GlobalCreateMenu() {
  const { user, profile } = useAuth();
  const { departments } = useDepartments();
  const navigate = useNavigate();
  const [createType, setCreateType] = useState<CreateType>(null);

  const [title, setTitle] = useState("");
  const [showDesc, setShowDesc] = useState(false);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignee, setAssignee] = useState("");
  const [deptId, setDeptId] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);

  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null }[]>([]);

  useEffect(() => {
    supabase.from("profiles").select("user_id, full_name").then(({ data }) => {
      if (data) setProfiles(data);
    });
  }, []);

  const reset = () => {
    setCreateType(null);
    setTitle("");
    setDescription("");
    setShowDesc(false);
    setPriority("medium");
    setAssignee("");
    setDeptId("");
    setDueDate(undefined);
  };

  const assigneeName = profiles.find(p => p.user_id === assignee)?.full_name;
  const deptName = departments.find(d => d.id === deptId)?.name;

  const handleCreate = async () => {
    if (!title.trim() || !user) return;
    switch (createType) {
      case "task": {
        const { error } = await supabase.from("tasks").insert({
          title: title.trim(),
          description,
          priority,
          created_by: user.id,
          assigned_to: assignee || user.id,
        });
        if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
        else { toast({ title: "Task created" }); reset(); }
        break;
      }
      case "project": {
        const { error } = await supabase.from("projects").insert({
          title: title.trim(),
          description,
          created_by: user.id,
          owner_id: assignee || user.id,
          department_id: deptId || null,
        });
        if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
        else { toast({ title: "Project created" }); reset(); }
        break;
      }
      case "reminder": {
        const { error } = await supabase.from("reminders").insert({
          title: title.trim(),
          description,
          user_id: user.id,
          assigned_to: assignee || null,
          due_at: dueDate ? dueDate.toISOString() : null,
        });
        if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
        else { toast({ title: "Reminder created" }); reset(); }
        break;
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && title.trim()) {
      e.preventDefault();
      handleCreate();
    }
  };

  const instantCreateNote = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("notes")
      .insert({ user_id: user.id, title: "Untitled Note", content: "" })
      .select("id")
      .single();
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else navigate("/notes", { state: { selectNoteId: data.id } });
  };

  const instantCreateDoc = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("documents")
      .insert({
        title: "Untitled",
        content: "",
        author_id: user.id,
        author_name: profile?.full_name || "Unknown",
        visibility: "workspace",
      })
      .select("id")
      .single();
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else navigate("/docs", { state: { selectDocId: data.id } });
  };

  const typeLabels: Record<string, string> = {
    task: "New Task",
    project: "New Project",
    reminder: "New Reminder",
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="h-8 w-8">
            <Plus className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setCreateType("task")}>
            <CheckSquare className="h-4 w-4 mr-2" /> Task
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setCreateType("project")}>
            <FolderKanban className="h-4 w-4 mr-2" /> Project
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setCreateType("reminder")}>
            <AlarmClock className="h-4 w-4 mr-2" /> Reminder
          </DropdownMenuItem>
          <DropdownMenuItem onClick={instantCreateNote}>
            <StickyNote className="h-4 w-4 mr-2" /> Quick Note
          </DropdownMenuItem>
          <DropdownMenuItem onClick={instantCreateDoc}>
            <FileText className="h-4 w-4 mr-2" /> Document
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!createType} onOpenChange={(o) => !o && reset()}>
        <DialogContent className="max-w-sm gap-0 p-5">
          <DialogHeader className="pb-3">
            <DialogTitle className="text-base">{createType ? typeLabels[createType] : ""}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Title input — no label */}
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Title..."
              className="border-0 px-0 text-base font-medium shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
              autoFocus
            />

            {/* Description — expandable */}
            {showDesc ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description..."
                rows={2}
                className="w-full resize-none rounded-md bg-muted/50 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none"
              />
            ) : (
              <button
                onClick={() => setShowDesc(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                + Add description
              </button>
            )}

            {/* Inline metadata row */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {/* Priority badges — task only */}
              {createType === "task" && (
                <div className="flex gap-1">
                  {priorityOptions.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setPriority(p.value)}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all",
                        priority === p.value ? p.className : "border-transparent text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Assignee picker */}
              {(createType === "task" || createType === "reminder") && (
                <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
                      <User className="h-3 w-3" />
                      {assigneeName || (createType === "reminder" ? "Delegate" : "Assign")}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1" align="start">
                    {profiles.map(p => (
                      <button
                        key={p.user_id}
                        onClick={() => { setAssignee(p.user_id); setAssigneeOpen(false); }}
                        className="w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-muted transition-colors"
                      >
                        {p.full_name || "Unnamed"}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              )}

              {/* Owner picker — project */}
              {createType === "project" && (
                <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
                      <User className="h-3 w-3" />
                      {assigneeName || "Owner"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1" align="start">
                    {profiles.map(p => (
                      <button
                        key={p.user_id}
                        onClick={() => { setAssignee(p.user_id); setAssigneeOpen(false); }}
                        className="w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-muted transition-colors"
                      >
                        {p.full_name || "Unnamed"}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              )}

              {/* Department picker — project */}
              {createType === "project" && departments.length > 0 && (
                <Popover open={deptOpen} onOpenChange={setDeptOpen}>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
                      <Building2 className="h-3 w-3" />
                      {deptName || "Department"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1" align="start">
                    {departments.map(d => (
                      <button
                        key={d.id}
                        onClick={() => { setDeptId(d.id); setDeptOpen(false); }}
                        className="w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-muted transition-colors"
                      >
                        {d.name}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              )}

              {/* Due date — reminder */}
              {createType === "reminder" && (
                <Popover open={calOpen} onOpenChange={setCalOpen}>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
                      <CalendarIcon className="h-3 w-3" />
                      {dueDate ? format(dueDate, "MMM d") : "Due date"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="flex gap-1 p-2 border-b">
                      {[
                        { label: "Today", date: new Date() },
                        { label: "Tomorrow", date: addDays(new Date(), 1) },
                        { label: "Next week", date: addDays(new Date(), 7) },
                      ].map(q => (
                        <button
                          key={q.label}
                          onClick={() => { setDueDate(q.date); setCalOpen(false); }}
                          className="rounded-md px-2.5 py-1 text-xs hover:bg-muted transition-colors"
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={(d) => { setDueDate(d); setCalOpen(false); }}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* Create action */}
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleCreate}
                disabled={!title.trim()}
                size="sm"
                className="h-8 px-4 text-xs"
              >
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
