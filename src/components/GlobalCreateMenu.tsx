import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, CheckSquare, FolderKanban, Bell, FileText } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type CreateType = "task" | "project" | "reminder" | "doc" | null;

export function GlobalCreateMenu() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [createType, setCreateType] = useState<CreateType>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const reset = () => {
    setCreateType(null);
    setTitle("");
    setDescription("");
  };

  const handleCreate = async () => {
    if (!title.trim() || !user) return;

    switch (createType) {
      case "task": {
        const { error } = await supabase.from("tasks").insert({
          title: title.trim(),
          description,
          created_by: user.id,
          assigned_to: user.id,
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
          owner_id: user.id,
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
        });
        if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
        else { toast({ title: "Reminder created" }); reset(); }
        break;
      }
      case "doc": {
        const { data, error } = await supabase.from("documents").insert({
          title: title.trim(),
          content: "",
          author_id: user.id,
          visibility: "workspace",
        }).select("id").single();
        if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
        else {
          toast({ title: "Document created" });
          reset();
          if (data) navigate("/docs");
        }
        break;
      }
    }
  };

  const typeLabels: Record<string, string> = {
    task: "New Task",
    project: "New Project",
    reminder: "New Reminder",
    doc: "New Document",
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
          <DropdownMenuItem onClick={() => setCreateType("doc")}>
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
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Optional description..." />
            </div>
            <Button onClick={handleCreate} className="w-full" disabled={!title.trim()}>
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
