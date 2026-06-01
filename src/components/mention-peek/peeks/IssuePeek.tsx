// IssuePeek — slide-over preview of a single issue. Mirrors the look of
// TaskPeek/ProjectPeek so peeks feel consistent across entity types.
//
// Shows: title, status, priority (P0-P3), category, raised-by, assigned-to,
// description, root cause + resolution if present. Status can be flipped
// inline (open / in_review / resolved / closed). "Open full issue" button
// navigates to /issues for filtering / kanban view since there is no single
// /issues/:id route yet.

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ExternalLink, Flag, Tag, User as UserIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ActivityPanel from "@/components/activity/ActivityPanel";

const sb = supabase as any;

interface Props { id: string; open: boolean; onClose: () => void; }

const STATUS_OPTIONS = [
  { value: "open",       label: "Open" },
  { value: "in_review",  label: "In Review" },
  { value: "resolved",   label: "Resolved" },
  { value: "closed",     label: "Closed" },
];

const STATUS_COLORS: Record<string, string> = {
  open:      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  in_review: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  resolved:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  closed:    "bg-muted text-muted-foreground",
};

// Priority is stored as integer 1-3 in this app (1 = highest).
const PRIORITY_LABEL: Record<number, string> = { 1: "P1 · High", 2: "P2 · Med", 3: "P3 · Low" };

export default function IssuePeek({ id, open, onClose }: Props) {
  const navigate = useNavigate();
  const [issue, setIssue] = useState<any>(null);
  const [raisedByName, setRaisedByName] = useState<string>("");
  const [assignedToName, setAssignedToName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await sb
      .from("issues")
      .select("id, title, description, status, priority, category, raised_by, assigned_to, root_cause, resolution, tags, created_at")
      .eq("id", id)
      .maybeSingle();
    setIssue(data);

    // Resolve names in parallel (cheap, fine on a peek)
    const lookups: Promise<void>[] = [];
    if (data?.raised_by) {
      lookups.push(sb.from("profiles").select("full_name").eq("user_id", data.raised_by).maybeSingle().then((r: any) => {
        setRaisedByName(r?.data?.full_name || "");
      }));
    } else { setRaisedByName(""); }
    if (data?.assigned_to) {
      lookups.push(sb.from("profiles").select("full_name").eq("user_id", data.assigned_to).maybeSingle().then((r: any) => {
        setAssignedToName(r?.data?.full_name || "");
      }));
    } else { setAssignedToName(""); }
    await Promise.all(lookups);
    setLoading(false);
  }, [id]);

  useEffect(() => { if (open && id) load(); }, [open, id, load]);

  const updateStatus = async (status: string) => {
    if (!issue) return;
    const { error } = await sb.from("issues").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { setIssue({ ...issue, status }); toast.success("Status updated"); }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-6">
        <SheetHeader className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span className="font-medium">Issue</span>
          </div>
          <SheetTitle className="text-xl leading-snug">
            {loading ? <span className="text-muted-foreground">Loading...</span> : (issue?.title || "Untitled issue")}
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="mt-12 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading issue...
          </div>
        ) : !issue ? (
          <div className="mt-12 text-center text-sm text-muted-foreground">Issue not found.</div>
        ) : (
          <div className="mt-6 space-y-5">
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={issue.status} onValueChange={updateStatus}>
                <SelectTrigger className="h-7 w-auto border-none shadow-none px-2 gap-1 focus:ring-0">
                  <Badge className={cn("text-[10px] rounded-full px-2.5 py-0.5 border-0", STATUS_COLORS[issue.status] || STATUS_COLORS.open)}>
                    {STATUS_OPTIONS.find(s => s.value === issue.status)?.label || issue.status}
                  </Badge>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {issue.priority != null && (
                <Badge variant="secondary" className="text-[10px] rounded-full">
                  <Flag className="h-3 w-3 mr-1" /> {PRIORITY_LABEL[issue.priority] ?? `P${issue.priority}`}
                </Badge>
              )}
              {issue.category && (
                <Badge variant="outline" className="text-[10px] rounded-full capitalize">
                  <Tag className="h-3 w-3 mr-1" /> {issue.category}
                </Badge>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-border/40">
              {raisedByName && (
                <div className="flex items-center gap-3 text-sm">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Raised by</span>
                  <span className="font-medium">{raisedByName}</span>
                </div>
              )}
              {assignedToName && (
                <div className="flex items-center gap-3 text-sm">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Assigned to</span>
                  <span className="font-medium">{assignedToName}</span>
                </div>
              )}
            </div>

            {issue.description && (
              <div className="pt-3 border-t border-border/40">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Description</p>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{issue.description}</p>
              </div>
            )}

            {issue.root_cause && (
              <div className="pt-3 border-t border-border/40">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Root cause</p>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{issue.root_cause}</p>
              </div>
            )}

            {issue.resolution && (
              <div className="pt-3 border-t border-border/40">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Resolution</p>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{issue.resolution}</p>
              </div>
            )}

            <div className="pt-3 border-t border-border/40">
              <ActivityPanel entityType="issue" entityId={id} />
            </div>

            <div className="pt-3 border-t border-border/40">
              <Button variant="outline" size="sm" className="w-full" onClick={() => { onClose(); navigate(`/issues`); }}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open in Issues
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
