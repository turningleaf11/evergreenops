import { formatDistanceToNow } from "date-fns";
import { Pin, AlertTriangle, PartyPopper, RefreshCw, Shield, Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ReactionBar } from "./ReactionBar";
import { ReplyThread } from "./ReplyThread";

const TYPE_CONFIG: Record<string, { label: string; icon: any; className: string; border: string }> = {
  urgent: { label: "Urgent", icon: AlertTriangle, className: "bg-red-500/10 text-red-600 dark:text-red-400", border: "border-l-red-500" },
  celebration: { label: "Celebration", icon: PartyPopper, className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", border: "border-l-emerald-500" },
  update: { label: "Update", icon: RefreshCw, className: "bg-blue-500/10 text-blue-600 dark:text-blue-400", border: "border-l-blue-500" },
  policy: { label: "Policy", icon: Shield, className: "bg-amber-500/10 text-amber-600 dark:text-amber-400", border: "border-l-amber-500" },
  general: { label: "General", icon: Megaphone, className: "bg-muted text-muted-foreground", border: "border-l-primary" },
};

interface AnnouncementCardProps {
  announcement: {
    id: string;
    title: string;
    content: string | null;
    author_name: string | null;
    pinned: boolean | null;
    type: string;
    banner_color: string | null;
    created_at: string;
  };
}

export function AnnouncementCard({ announcement }: AnnouncementCardProps) {
  const config = TYPE_CONFIG[announcement.type] || TYPE_CONFIG.general;
  const Icon = config.icon;

  return (
    <div className={`rounded-xl border border-l-4 ${config.border} bg-card p-4 space-y-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={`text-[10px] gap-1 ${config.className}`}>
            <Icon className="h-3 w-3" />
            {config.label}
          </Badge>
          {announcement.pinned && (
            <Pin className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
        </span>
      </div>

      <div>
        <h3 className="font-semibold text-sm">{announcement.title}</h3>
        {announcement.content && (
          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{announcement.content}</p>
        )}
      </div>

      {announcement.author_name && (
        <p className="text-[10px] text-muted-foreground">Posted by {announcement.author_name}</p>
      )}

      <ReactionBar entityType="announcement" entityId={announcement.id} />
      <ReplyThread entityType="announcement" entityId={announcement.id} />
    </div>
  );
}
