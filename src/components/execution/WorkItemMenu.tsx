import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link2, Copy, Archive, ArrowRightLeft, Trash2, MoreHorizontal } from "lucide-react";
import type { WorkItemKind } from "@/hooks/useProjectWorkItems";

// Same menu shape as the Project header's "..." (Copy link / Duplicate /
// Archive / Delete), plus Move — the one action specific to work items,
// since a task or agent_task can change which table it lives in (Execution
// Hub <-> AI Hub) without changing what it is. Self-contained: fetches its
// own agent/profile lists on open rather than requiring callers to pass
// them down.
export default function WorkItemMenu({
  id, kind, title, onDuplicated, onArchived, onDeleted, onMoved,
}: {
  id: string;
  kind: WorkItemKind;
  title: string;
  onDuplicated?: () => void;
  onArchived?: () => void;
  onDeleted?: () => void;
  onMoved?: () => void;
}) {
  const { user } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [agents, setAgents] = useState<{ slug: string; name: string }[]>([]);
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [loadedMoveTargets, setLoadedMoveTargets] = useState(false);

  const table = kind === "agent_task" ? "agent_tasks" : "tasks";

  const loadMoveTargets = async () => {
    if (loadedMoveTargets) return;
    if (kind === "task") {
      const { data } = await supabase.from("agents").select("slug, name");
      setAgents(data || []);
    } else {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      setProfiles(data || []);
    }
    setLoadedMoveTargets(true);
  };

  const copyLink = () => {
    const url = kind === "task"
      ? `${window.location.origin}/tasks/${id}`
      : `${window.location.origin}/ai-hub`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  const duplicate = async () => {
    const { data: row, error: fetchError } = await supabase.from(table).select("*").eq("id", id).single();
    if (fetchError || !row) { toast.error(fetchError?.message || "Couldn't load item"); return; }
    const { id: _id, created_at, updated_at, ...rest } = row as any;
    const { error } = await supabase.from(table).insert({ ...rest, title: `${(row as any).title} (copy)` } as any);
    if (error) toast.error(error.message);
    else { toast.success("Duplicated"); onDuplicated?.(); }
  };

  const archive = async () => {
    const { error } = await supabase.from(table).update({ archived: true } as any).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Archived"); onArchived?.(); }
  };

  const deleteItem = async () => {
    const { error } = await supabase.from(table).delete().eq("id", id);
    setDeleteOpen(false);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); onDeleted?.(); }
  };

  // Move = transplant the row into the other table under its new owner,
  // carrying the fields both tables share, then drop the original.
  const moveToAgent = async (agentSlug: string) => {
    const { data: row, error: fetchError } = await supabase.from("tasks").select("*").eq("id", id).single();
    if (fetchError || !row) { toast.error(fetchError?.message || "Couldn't load task"); return; }
    const t = row as any;
    const { error: insertError } = await supabase.from("agent_tasks").insert({
      title: t.title,
      description: t.description || t.title,
      assigned_to: agentSlug,
      type: "general",
      project_id: t.project_id,
      goal_id: t.goal_id,
      due_date: t.due_date,
      priority: t.priority || "normal",
      status: "backlog",
      created_by: "human",
    } as any);
    if (insertError) { toast.error(insertError.message); return; }
    await supabase.from("tasks").delete().eq("id", id);
    toast.success("Moved to AI Hub");
    onMoved?.();
  };

  const moveToPerson = async (userId: string) => {
    const { data: row, error: fetchError } = await supabase.from("agent_tasks").select("*").eq("id", id).single();
    if (fetchError || !row) { toast.error(fetchError?.message || "Couldn't load task"); return; }
    const t = row as any;
    const { error: insertError } = await supabase.from("tasks").insert({
      title: t.title,
      description: t.description,
      assigned_to: userId,
      project_id: t.project_id,
      goal_id: t.goal_id,
      due_date: t.due_date,
      priority: t.priority === "normal" ? "medium" : t.priority,
      status: t.status,
      created_by: user?.id,
    } as any);
    if (insertError) { toast.error(insertError.message); return; }
    await supabase.from("agent_tasks").delete().eq("id", id);
    toast.success("Moved to Execution Hub");
    onMoved?.();
  };

  return (
    <>
      <DropdownMenu onOpenChange={(o) => { if (o) loadMoveTargets(); }}>
        <DropdownMenuTrigger asChild>
          <button
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
            aria-label="More"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={copyLink}>
            <Link2 className="h-3.5 w-3.5 mr-2" /> Copy link
          </DropdownMenuItem>
          <DropdownMenuItem onClick={duplicate}>
            <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onClick={archive}>
            <Archive className="h-3.5 w-3.5 mr-2" /> Archive
          </DropdownMenuItem>

          {kind === "task" ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <ArrowRightLeft className="h-3.5 w-3.5 mr-2" /> Move to AI Hub
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {agents.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No agents</div>
                ) : (
                  agents.map((a) => (
                    <DropdownMenuItem key={a.slug} onClick={() => moveToAgent(a.slug)}>
                      {a.name}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <ArrowRightLeft className="h-3.5 w-3.5 mr-2" /> Move to Execution Hub
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {profiles.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No people</div>
                ) : (
                  profiles.map((p) => (
                    <DropdownMenuItem key={p.user_id} onClick={() => moveToPerson(p.user_id)}>
                      {p.full_name || "Unknown"}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-destructive focus:text-destructive">
            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{title}"?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteItem} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
