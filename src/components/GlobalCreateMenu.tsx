import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, CheckSquare, FolderKanban, Bell, FileText, StickyNote } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type CreateType = "task" | "project" | "reminder" | null;

export function GlobalCreateMenu() {
  const { user, profile } = useAuth();
  const { departments } = useDepartments();
  const navigate = useNavigate();
  const [createType, setCreateType] = useState<CreateType>(null);

  // Task fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignee, setAssignee] = useState("");
  const [deptId, setDeptId] = useState("");
  const [dueDate, setDueDate] = useState("");

  // People for pickers
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
    setPriority("medium");
    setAssignee("");
    setDeptId("");
    setDueDate("");
  };

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
          due_at: dueDate || null,
        });
        if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
        else { toast({ title: "Reminder created" }); reset(); }
        break;
      }
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
    else {
      navigate("/notes", { state: { selectNoteId: data.id } });
    }
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
    else {
      navigate("/docs", { state: { selectDocId: data.id } });
    }
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
            <Bell className="h-4 w-4 mr-2" /> Reminder
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{createType ? typeLabels[createType] : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter a title..." autoFocus />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional description..." />
            </div>

            {/* Task-specific fields */}
            {createType === "task" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Assignee</Label>
                  <Select value={assignee} onValueChange={setAssignee}>
                    <SelectTrigger><SelectValue placeholder="Me" /></SelectTrigger>
                    <SelectContent>
                      {profiles.map(p => (
                        <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Unnamed"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Project-specific fields */}
            {createType === "project" && (
              <div className="grid grid-cols-2 gap-3">
                {departments.length > 0 && (
                  <div>
                    <Label>Department</Label>
                    <Select value={deptId} onValueChange={setDeptId}>
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>
                        {departments.map(d => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Owner</Label>
                  <Select value={assignee} onValueChange={setAssignee}>
                    <SelectTrigger><SelectValue placeholder="Me" /></SelectTrigger>
                    <SelectContent>
                      {profiles.map(p => (
                        <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Unnamed"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Reminder-specific fields */}
            {createType === "reminder" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Due date & time</Label>
                  <Input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
                <div>
                  <Label>Delegate to</Label>
                  <Select value={assignee} onValueChange={setAssignee}>
                    <SelectTrigger><SelectValue placeholder="Just me" /></SelectTrigger>
                    <SelectContent>
                      {profiles.map(p => (
                        <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Unnamed"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <Button onClick={handleCreate} className="w-full" disabled={!title.trim()}>
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
