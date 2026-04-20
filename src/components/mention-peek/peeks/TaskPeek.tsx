import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, User, Flag, ExternalLink, CheckSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import CommentsSection from "@/components/CommentsSection";

interface Props { id: string; open: boolean; onClose: () => void; }

const statusOptions = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "blocked", label: "Blocked" },
];

const statusColors: Record<string, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  done: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  blocked: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export default function TaskPeek({ id, open, onClose }: Props) {
  const navigate = useNavigate();
  const [row, setRow] = useState<any>(null);
  const [assigneeName, setAssigneeName] = useState<string>("");

  const load = useCallback(async () => {
    const { data } = await supabase.from("database_rows").select("*").eq("id", id).maybeSingle();
    setRow(data);
    const assigneeId = data?.values?.assigned_to || data?.values?.owner_id;
    if (assigneeId) {
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("user_id", assigneeId).maybeSingle();
      setAssigneeName(prof?.full_name || "");
    }
  }, [id]);

  useEffect(() => { if (open && id) load(); }, [open, id, load]);

  const updateStatus = async (status: string) => {
    if (!row) return;
    const nextValues = { ...(row.values || {}), status };
    const { error } = await supabase.from("database_rows").update({ values: nextValues }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else setRow({ ...row, values: nextValues });
  };

  const v = row?.values || {};
  const title = v.title || v.name || "Untitled task";
  const status = v.status || "todo";
  const priority = v.priority;
  const dueDate = v.due_date;
  const description = v.description;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-6">
        <SheetHeader className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckSquare className="h-3.5 w-3.5 text-primary/70" />
            <span className="font-medium">Task</span>
          </div>
          <SheetTitle className="text-xl">{title}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={status} onValueChange={updateStatus}>
              <SelectTrigger className="h-7 w-auto border-none shadow-none px-2 gap-1 focus:ring-0">
                <Badge className={cn("text-[10px] rounded-full px-2.5 py-0.5 border-0", statusColors[status])}>
                  {statusOptions.find(s => s.value === status)?.label || status}
                </Badge>
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {priority && (
              <Badge variant="secondary" className="text-[10px] rounded-full capitalize">
                <Flag className="h-3 w-3 mr-1" /> {priority}
              </Badge>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-border/40">
            {assigneeName && (
              <div className="flex items-center gap-3 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{assigneeName}</span>
              </div>
            )}
            {dueDate && (
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
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
            <CommentsSection entityType="task" entityId={id} />
          </div>

          <div className="pt-3 border-t border-border/40">
            <Button variant="outline" size="sm" className="w-full" onClick={() => { onClose(); navigate(`/tasks/${id}`); }}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open full task
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
