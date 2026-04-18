import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, User, Tag, Flag, AlertCircle } from "lucide-react";
import CommentsSection from "@/components/CommentsSection";
import { FieldRow } from "@/components/shared/AccordionField";
import { cn } from "@/lib/utils";

interface EditableTitleProps {
  value: string;
  onSave: (next: string) => void;
  className?: string;
}

function EditableTitle({ value, onSave, className }: EditableTitleProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft.trim() && draft !== value) onSave(draft.trim()); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.currentTarget.blur(); }
        if (e.key === "Escape") { setDraft(value); e.currentTarget.blur(); }
      }}
      className={cn(
        "w-full bg-transparent border-0 outline-none focus:ring-0 px-0 py-1 rounded-md hover:bg-muted/30 focus:bg-muted/30 transition-colors",
        className,
      )}
    />
  );
}

interface DetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "project" | "task";
  item: any;
  onStatusChange: (status: string) => void;
  onTitleChange?: (title: string) => void;
  getName: (uid: string | null) => string;
}

const projectStatuses = ["not_started", "in_progress", "done", "blocked"];
const taskStatuses = ["todo", "in_progress", "done"];
const priorities = ["low", "medium", "high", "urgent"];

const statusLabels: Record<string, string> = {
  not_started: "Not Started", in_progress: "In Progress", done: "Done",
  blocked: "Blocked", todo: "To Do",
};

const statusColors: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  done: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  blocked: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const priorityColors: Record<string, string> = {
  low: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  high: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  urgent: "bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-200",
};

function OptionRow({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors text-left",
        selected ? "bg-primary/10 text-foreground" : "hover:bg-muted text-foreground/80"
      )}
    >
      <span>{children}</span>
    </button>
  );
}

function DetailContent({ type, item, onStatusChange, getName }: {
  type: "project" | "task"; item: any; onStatusChange: (s: string) => void;
  getName: (uid: string | null) => string;
}) {
  const statuses = type === "project" ? projectStatuses : taskStatuses;

  return (
    <div className="space-y-5">
      <div className="pb-4 border-b border-border/50">
        <div className="flex items-start gap-2 flex-wrap">
          <Badge className={cn("text-[10px] rounded-full px-2.5 py-0.5 border-0 font-medium", statusColors[item.status] || statusColors.not_started)}>
            {statusLabels[item.status] || item.status}
          </Badge>
          {item.priority && (
            <Badge className={cn("text-[10px] rounded-full px-2.5 py-0.5 border-0 font-medium capitalize", priorityColors[item.priority])}>
              {item.priority}
            </Badge>
          )}
        </div>
      </div>

      <div>
        <FieldRow
          label="Status"
          icon={AlertCircle}
          displayValue={
            <Badge className={cn("text-[10px] rounded-full px-2 py-0.5 border-0 font-medium", statusColors[item.status])}>
              {statusLabels[item.status] || item.status}
            </Badge>
          }
        >
          {(close) => (
            <div className="space-y-0.5">
              {statuses.map(s => (
                <OptionRow key={s} selected={item.status === s} onClick={() => { onStatusChange(s); close(); }}>
                  {statusLabels[s] || s}
                </OptionRow>
              ))}
            </div>
          )}
        </FieldRow>

        {item.priority !== undefined && (
          <FieldRow
            label="Priority"
            icon={Flag}
            displayValue={
              item.priority ? (
                <Badge className={cn("text-[10px] rounded-full px-2 py-0.5 border-0 font-medium capitalize", priorityColors[item.priority])}>
                  {item.priority}
                </Badge>
              ) : null
            }
          >
            {(close) => (
              <div className="space-y-0.5">
                {priorities.map(p => (
                  <OptionRow key={p} selected={item.priority === p} onClick={() => close()}>
                    <span className="capitalize">{p}</span>
                  </OptionRow>
                ))}
              </div>
            )}
          </FieldRow>
        )}

        <FieldRow
          label={type === "project" ? "Owner" : "Assignee"}
          icon={User}
          displayValue={getName(type === "project" ? item.owner_id : item.assigned_to)}
        >
          <p className="text-xs text-muted-foreground py-1 px-2">Currently: {getName(type === "project" ? item.owner_id : item.assigned_to)}</p>
        </FieldRow>

        {item.due_date && (
          <FieldRow
            label="Due date"
            icon={Calendar}
            displayValue={item.due_date}
          >
            <input
              type="date"
              defaultValue={item.due_date}
              className="bg-background border border-border rounded-md px-2 py-1 text-sm w-full"
            />
          </FieldRow>
        )}

        {item.tags && item.tags.length > 0 && (
          <FieldRow
            label="Tags"
            icon={Tag}
            displayValue={
              <div className="flex flex-wrap gap-1">
                {item.tags.map((t: string) => (
                  <Badge key={t} variant="secondary" className="text-[10px] rounded-full">{t}</Badge>
                ))}
              </div>
            }
          >
            <div className="flex flex-wrap gap-1 p-1">
              {item.tags.map((t: string) => (
                <Badge key={t} variant="secondary" className="text-[10px] rounded-full">{t}</Badge>
              ))}
            </div>
          </FieldRow>
        )}
      </div>

      {item.description && (
        <Card className="bg-muted/30 border-border/30">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Description</p>
            <p className="text-sm text-foreground/90 leading-relaxed">{item.description}</p>
          </CardContent>
        </Card>
      )}

      {type === "task" && item.subtasks && item.subtasks.length > 0 && (
        <Card className="bg-muted/30 border-border/30">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">Subtasks</p>
            <div className="space-y-2">
              {item.subtasks.map((st: any, i: number) => (
                <div key={i} className="flex items-center gap-2.5 text-sm">
                  <input type="checkbox" checked={st.done} readOnly className="rounded border-border" />
                  <span className={st.done ? "line-through text-muted-foreground" : ""}>{st.title}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="pt-2 border-t border-border/30">
        <CommentsSection entityType={type} entityId={item.id} />
      </div>
    </div>
  );
}

export default function DetailDrawer({ open, onOpenChange, type, item, onStatusChange, onTitleChange, getName }: DetailDrawerProps) {
  const navigate = useNavigate();

  // Projects always open as a full page — never a peek.
  useEffect(() => {
    if (open && type === "project" && item) {
      onOpenChange(false);
      navigate(`/projects/${item.id}`);
    }
  }, [open, type, item, navigate, onOpenChange]);

  if (!item || type === "project") return null;

  const titleNode = onTitleChange ? (
    <EditableTitle value={item.title} onSave={onTitleChange} className="text-xl font-semibold" />
  ) : (
    <span className="text-xl font-semibold">{item.title}</span>
  );

  // Tasks → side peek (Sheet)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-6 top-[60px] h-[calc(100vh-60px)] border-l border-border/50">
        <SheetHeader className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <SheetTitle asChild>
              <div className="flex-1 min-w-0 pr-2">{titleNode}</div>
            </SheetTitle>
          </div>
        </SheetHeader>
        <div className="mt-6">
          <DetailContent type={type} item={item} onStatusChange={onStatusChange} getName={getName} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
