import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, User, ExternalLink, FolderKanban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props { id: string; open: boolean; onClose: () => void; }

const statusColors: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  done: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  blocked: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const statusLabels: Record<string, string> = {
  not_started: "Not Started", in_progress: "In Progress", done: "Done", blocked: "Blocked",
};

export default function ProjectPeek({ id, open, onClose }: Props) {
  const navigate = useNavigate();
  const [p, setP] = useState<any>(null);
  const [ownerName, setOwnerName] = useState<string>("");

  useEffect(() => {
    if (!open || !id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
      if (cancelled) return;
      setP(data);
      if (data?.owner_id) {
        const { data: prof } = await supabase.from("profiles").select("full_name").eq("user_id", data.owner_id).maybeSingle();
        if (!cancelled) setOwnerName(prof?.full_name || "");
      }
    })();
    return () => { cancelled = true; };
  }, [id, open]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-6">
        <SheetHeader className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FolderKanban className="h-3.5 w-3.5 text-primary/70" />
            <span className="font-medium">Project</span>
          </div>
          <SheetTitle className="text-xl">{p?.title || "Loading..."}</SheetTitle>
        </SheetHeader>

        {p && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn("text-[10px] rounded-full px-2.5 py-0.5 border-0", statusColors[p.status])}>
                {statusLabels[p.status] || p.status}
              </Badge>
              {p.priority && (
                <Badge variant="secondary" className="text-[10px] rounded-full capitalize">{p.priority}</Badge>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-border/40">
              {ownerName && (
                <div className="flex items-center gap-3 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{ownerName}</span>
                </div>
              )}
              {p.due_date && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{p.due_date}</span>
                </div>
              )}
            </div>

            {p.description && (
              <div className="pt-3 border-t border-border/40">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Description</p>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap">{p.description}</p>
              </div>
            )}

            {p.notes_content && (
              <div className="pt-3 border-t border-border/40">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Notes</p>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none line-clamp-[12]"
                  dangerouslySetInnerHTML={{ __html: p.notes_content }}
                />
              </div>
            )}

            <div className="pt-4 border-t border-border/40">
              <Button size="sm" className="w-full" onClick={() => { onClose(); navigate(`/projects/${id}`); }}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open full project
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
