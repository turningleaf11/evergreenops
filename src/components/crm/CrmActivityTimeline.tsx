import { Link } from "react-router-dom";
import {
  Mail,
  NotebookPen,
  Phone,
  Users,
  CheckCircle2,
  MessageSquare,
  ArrowRightCircle,
  ExternalLink,
  Reply,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TimelineActivity {
  id: string;
  type: string;
  subject: string;
  body: string;
  occurred_at: string;
  actor_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface PersonLite {
  user_id: string;
  full_name: string | null;
  avatar_url?: string | null;
}

const ICON_MAP: Record<string, { icon: any; bg: string; fg: string }> = {
  email:        { icon: Mail,            bg: "bg-amber-100",     fg: "text-amber-700" },
  note:         { icon: NotebookPen,     bg: "bg-blue-100",      fg: "text-blue-700" },
  call:         { icon: Phone,           bg: "bg-violet-100",    fg: "text-violet-700" },
  meeting:      { icon: Users,           bg: "bg-emerald-100",   fg: "text-emerald-700" },
  task:         { icon: CheckCircle2,    bg: "bg-green-100",     fg: "text-green-700" },
  text:         { icon: MessageSquare,   bg: "bg-sky-100",       fg: "text-sky-700" },
  stage_change: { icon: ArrowRightCircle, bg: "bg-muted",        fg: "text-muted-foreground" },
};

function actorName(actorId: string | null | undefined, people: PersonLite[]) {
  if (!actorId) return "System";
  const p = people.find((pp) => pp.user_id === actorId);
  return p?.full_name || "Someone";
}

export function CrmActivityTimeline({
  activities,
  people = [],
  filter = "all",
  onReply,
}: {
  activities: TimelineActivity[];
  people?: PersonLite[];
  filter?: string;
  onReply?: (activity: TimelineActivity) => void;
}) {
  const list = filter === "all" ? activities : activities.filter((a) => a.type === filter);

  if (list.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-10 text-center">
        Nothing here yet. Add a note or send an email above.
      </p>
    );
  }

  return (
    <div className="relative pl-12 pr-1 py-2">
      {/* vertical rail */}
      <div className="absolute left-[22px] top-2 bottom-2 w-px bg-border/60" />
      <div className="space-y-4">
        {list.map((a) => {
          const cfg = ICON_MAP[a.type] || ICON_MAP.note;
          const Icon = cfg.icon;
          const meta = a.metadata as any;
          const threadId = meta?.gmail_thread_id as string | undefined;
          const isEmail = a.type === "email" && threadId;
          const isStage = a.type === "stage_change";
          const isNote = a.type === "note";

          return (
            <div key={a.id} className="relative">
              {/* node */}
              <div
                className={cn(
                  "absolute -left-[34px] top-0.5 h-7 w-7 rounded-full flex items-center justify-center ring-4 ring-background",
                  cfg.bg,
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", cfg.fg)} />
              </div>

              {isStage ? (
                <div className="text-sm">
                  <div className="font-medium">{a.subject || "Stage changed"}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(a.occurred_at).toLocaleDateString()} ·{" "}
                    {actorName(a.actor_id, people)}
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "rounded-lg p-3 text-sm",
                    isNote
                      ? "border border-amber-300/40"
                      : "border border-border/40 bg-card",
                  )}
                  style={isNote ? { backgroundColor: "#FFF7B8" } : undefined}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0 flex-1">
                      {a.subject && (
                        <div className="font-medium leading-tight truncate">{a.subject}</div>
                      )}
                      <div className={cn("text-[11px] mt-0.5", isNote ? "text-amber-900/70" : "text-muted-foreground")}>
                        {new Date(a.occurred_at).toLocaleDateString()} ·{" "}
                        {actorName(a.actor_id, people)} ·{" "}
                        {formatDistanceToNow(new Date(a.occurred_at), { addSuffix: true })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isEmail && onReply && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => onReply(a)}
                        >
                          <Reply className="h-3 w-3 mr-1" /> Reply
                        </Button>
                      )}
                      {isEmail && (
                        <Link
                          to={`/inbox?thread=${threadId}`}
                          className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center"
                          title="Open in inbox"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                  {a.body && (
                    isNote ? (
                      <div
                        className="prose prose-sm max-w-none text-amber-950/90 [&_p]:my-1 [&_p:empty]:hidden"
                        dangerouslySetInnerHTML={{ __html: a.body }}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-muted-foreground line-clamp-6">
                        {a.body}
                      </p>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ActivityFilterPills({
  activities,
  value,
  onChange,
}: {
  activities: TimelineActivity[];
  value: string;
  onChange: (v: string) => void;
}) {
  const counts = activities.reduce<Record<string, number>>((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {});
  const pills: { key: string; label: string; icon: any }[] = [
    { key: "all", label: "All", icon: null },
    { key: "email", label: "Email", icon: Mail },
    { key: "note", label: "Note", icon: NotebookPen },
    { key: "call", label: "Call", icon: Phone },
    { key: "meeting", label: "Meeting", icon: Users },
    { key: "task", label: "Task", icon: CheckCircle2 },
    { key: "stage_change", label: "Stage", icon: ArrowRightCircle },
  ];
  return (
    <div className="flex items-center gap-1 flex-wrap border-b border-border/40 px-1 pb-2">
      {pills.map((p) => {
        const n = p.key === "all" ? activities.length : counts[p.key] || 0;
        const active = value === p.key;
        const Icon = p.icon;
        return (
          <button
            key={p.key}
            onClick={() => onChange(p.key)}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/50",
            )}
          >
            {Icon && <Icon className="h-3 w-3" />}
            <span>{p.label}</span>
            <span className="opacity-60">({n})</span>
          </button>
        );
      })}
    </div>
  );
}
