import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Maximize2, Calendar, User } from "lucide-react";
import CommentsSection from "@/components/CommentsSection";

interface DetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "project" | "task";
  item: any;
  onStatusChange: (status: string) => void;
  getName: (uid: string | null) => string;
}

const projectStatuses = ["not_started", "in_progress", "done", "blocked"];
const taskStatuses = ["todo", "in_progress", "done"];

const statusLabels: Record<string, string> = {
  not_started: "Not Started", in_progress: "In Progress", done: "Done",
  blocked: "Blocked", todo: "To Do",
};

export default function DetailDrawer({ open, onOpenChange, type, item, onStatusChange, getName }: DetailDrawerProps) {
  const navigate = useNavigate();
  if (!item) return null;

  const statuses = type === "project" ? projectStatuses : taskStatuses;
  const detailPath = type === "project" ? `/projects/${item.id}` : `/tasks/${item.id}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg pr-8">{item.title}</SheetTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => { onOpenChange(false); navigate(detailPath); }}
          >
            <Maximize2 className="h-3.5 w-3.5 mr-1.5" /> Open full page
          </Button>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-20">Status</span>
            <Select value={item.status} onValueChange={onStatusChange}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {statuses.map(s => (
                  <SelectItem key={s} value={s}>{statusLabels[s] || s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          {item.priority && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-20">Priority</span>
              <Badge variant="outline" className="text-xs capitalize">{item.priority}</Badge>
            </div>
          )}

          {/* Owner/Assignee */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-20">
              {type === "project" ? "Owner" : "Assignee"}
            </span>
            <div className="flex items-center gap-1.5 text-sm">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              {getName(type === "project" ? item.owner_id : item.assigned_to)}
            </div>
          </div>

          {/* Due date */}
          {item.due_date && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-20">Due</span>
              <div className="flex items-center gap-1.5 text-sm">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {item.due_date}
              </div>
            </div>
          )}

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="flex items-start gap-3">
              <span className="text-sm text-muted-foreground w-20 pt-0.5">Tags</span>
              <div className="flex flex-wrap gap-1">
                {item.tags.map((t: string) => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {item.description && (
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Description</span>
              <p className="text-sm text-foreground/90">{item.description}</p>
            </div>
          )}

          {/* Subtasks for tasks */}
          {type === "task" && item.subtasks && item.subtasks.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Subtasks</span>
              {item.subtasks.map((st: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={st.done} readOnly className="rounded" />
                  <span className={st.done ? "line-through text-muted-foreground" : ""}>{st.title}</span>
                </div>
              ))}
            </div>
          )}

          {/* Comments */}
          <div className="border-t pt-4">
            <CommentsSection entityType={type} entityId={item.id} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
