import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Maximize2, Calendar, User, PanelRight, Square, Expand, ChevronDown } from "lucide-react";
import CommentsSection from "@/components/CommentsSection";

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

const peekModes: { value: PeekMode; label: string; icon: React.ElementType }[] = [
  { value: "side", label: "Side peek", icon: PanelRight },
  { value: "center", label: "Center peek", icon: Square },
  { value: "full", label: "Full page", icon: Expand },
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

function DetailContent({ type, item, onStatusChange, getName, onFullPage, peekMode, setPeekMode }: {
  type: "project" | "task"; item: any; onStatusChange: (s: string) => void;
  getName: (uid: string | null) => string; onFullPage: () => void;
  peekMode: PeekMode; setPeekMode: (m: PeekMode) => void;
}) {
  const statuses = type === "project" ? projectStatuses : taskStatuses;

  return (
    <div className="space-y-6">
      {/* Mode switcher */}
      <div className="flex items-center justify-between">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
              {(() => { const m = peekModes.find(p => p.value === peekMode); const Icon = m?.icon || PanelRight; return <Icon className="h-3.5 w-3.5" />; })()}
              {peekModes.find(p => p.value === peekMode)?.label}
              <ChevronDown className="h-3 w-3 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {peekModes.map(m => (
              <DropdownMenuItem key={m.value} onClick={() => {
                if (m.value === "full") { onFullPage(); return; }
                setPeekMode(m.value);
              }}>
                <m.icon className="h-3.5 w-3.5 mr-2" />
                {m.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={onFullPage}>
          <Maximize2 className="h-3 w-3" /> Open full page
        </Button>
      </div>

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
  );
}

export default function DetailDrawer({ open, onOpenChange, type, item, onStatusChange, getName }: DetailDrawerProps) {
  const navigate = useNavigate();
  const [peekMode, setPeekMode] = usePeekMode();

  // Handle full page mode — navigate immediately when opened
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg pr-8">{item.title}</DialogTitle>
          </DialogHeader>
          <DetailContent
            type={type} item={item} onStatusChange={onStatusChange}
            getName={getName} onFullPage={goFullPage}
            peekMode={peekMode} setPeekMode={setPeekMode}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-3">
          <SheetTitle className="text-lg pr-8">{item.title}</SheetTitle>
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
