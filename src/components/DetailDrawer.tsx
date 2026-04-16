import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Maximize2, Calendar, User, PanelRight, Square, Expand, Tag, Flag, AlertCircle } from "lucide-react";
import CommentsSection from "@/components/CommentsSection";
import { cn } from "@/lib/utils";

type PeekMode = "side" | "center" | "full";

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

const peekModes: { value: PeekMode; icon: React.ElementType; label: string }[] = [
  { value: "side", icon: PanelRight, label: "Side peek" },
  { value: "center", icon: Square, label: "Center peek" },
  { value: "full", icon: Expand, label: "Full page" },
];

function usePeekMode(): [PeekMode, (m: PeekMode) => void] {
  const [mode, setMode] = useState<PeekMode>(() => {
    try { return (localStorage.getItem("detail-peek-mode") as PeekMode) || "side"; } catch { return "side"; }
  });
  const set = (m: PeekMode) => {
    setMode(m);
    try { localStorage.setItem("detail-peek-mode", m); } catch {}
  };
  return [mode, set];
}

function PropertyRow({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex items-center gap-2 w-28 shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function DetailContent({ type, item, onStatusChange, getName, onFullPage, peekMode, setPeekMode }: {
  type: "project" | "task"; item: any; onStatusChange: (s: string) => void;
  getName: (uid: string | null) => string; onFullPage: () => void;
  peekMode: PeekMode; setPeekMode: (m: PeekMode) => void;
}) {
  const statuses = type === "project" ? projectStatuses : taskStatuses;

  return (
    <div className="space-y-5">
      {/* Toolbar: mode switcher + full page */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0.5 rounded-lg bg-muted/50 p-0.5">
          {peekModes.map(m => (
            <button
              key={m.value}
              onClick={() => {
                if (m.value === "full") { onFullPage(); return; }
                setPeekMode(m.value);
              }}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                peekMode === m.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={m.label}
            >
              <m.icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={onFullPage}>
          <Maximize2 className="h-3 w-3" /> Open full page
        </Button>
      </div>

      {/* Header zone */}
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

      {/* Property grid */}
      <div className="divide-y divide-border/30">
        <PropertyRow icon={AlertCircle} label="Status">
          <Select value={item.status} onValueChange={onStatusChange}>
            <SelectTrigger className="w-36 h-7 text-xs border-border/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              {statuses.map(s => (
                <SelectItem key={s} value={s}>{statusLabels[s] || s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PropertyRow>

        {item.priority && (
          <PropertyRow icon={Flag} label="Priority">
            <span className="text-sm capitalize">{item.priority}</span>
          </PropertyRow>
        )}

        <PropertyRow icon={User} label={type === "project" ? "Owner" : "Assignee"}>
          <span className="text-sm">{getName(type === "project" ? item.owner_id : item.assigned_to)}</span>
        </PropertyRow>

        {item.due_date && (
          <PropertyRow icon={Calendar} label="Due date">
            <span className="text-sm">{item.due_date}</span>
          </PropertyRow>
        )}

        {item.tags && item.tags.length > 0 && (
          <PropertyRow icon={Tag} label="Tags">
            <div className="flex flex-wrap gap-1">
              {item.tags.map((t: string) => (
                <Badge key={t} variant="secondary" className="text-[10px] rounded-full">{t}</Badge>
              ))}
            </div>
          </PropertyRow>
        )}
      </div>

      {/* Description */}
      {item.description && (
        <Card className="bg-muted/30 border-border/30">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Description</p>
            <p className="text-sm text-foreground/90 leading-relaxed">{item.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Subtasks */}
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

      {/* Comments */}
      <div className="pt-2 border-t border-border/30">
        <CommentsSection entityType={type} entityId={item.id} />
      </div>
    </div>
  );
}

export default function DetailDrawer({ open, onOpenChange, type, item, onStatusChange, getName }: DetailDrawerProps) {
  const navigate = useNavigate();
  const [peekMode, setPeekMode] = usePeekMode();

  useEffect(() => {
    if (open && peekMode === "full" && item) {
      onOpenChange(false);
      navigate(type === "project" ? `/projects/${item.id}` : `/tasks/${item.id}`);
    }
  }, [open, peekMode, item]);

  if (!item) return null;

  const detailPath = type === "project" ? `/projects/${item.id}` : `/tasks/${item.id}`;
  const goFullPage = () => { onOpenChange(false); navigate(detailPath); };

  if (peekMode === "center") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold pr-8">
              {item.title}
            </DialogTitle>
          </DialogHeader>
          <div>
            <DetailContent
              type={type} item={item} onStatusChange={onStatusChange}
              getName={getName} onFullPage={goFullPage}
              peekMode={peekMode} setPeekMode={setPeekMode}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-6 top-[60px] h-[calc(100vh-60px)] border-l border-border/50">
        <SheetHeader className="space-y-3">
          <SheetTitle className="text-xl font-semibold pr-8">
            {item.title}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          <DetailContent
            type={type} item={item} onStatusChange={onStatusChange}
            getName={getName} onFullPage={goFullPage}
            peekMode={peekMode} setPeekMode={setPeekMode}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
