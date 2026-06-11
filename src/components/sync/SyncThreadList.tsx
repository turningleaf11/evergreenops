import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import { SyncChannel, SyncTag, SyncThread } from "@/hooks/useSync";
import { SyncTagBadge } from "./SyncTagBadge";
import { cn } from "@/lib/utils";

const sb = supabase as any;

function relTime(iso: string): string {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return ""; }
}
function initials(name: string | null) {
  return (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

interface Props {
  threads: SyncThread[];
  channels: SyncChannel[];
  tags: SyncTag[];
  selectedThreadId?: string | null;
  onSelect: (threadId: string) => void;
  emptyHint?: string;
}

export function SyncThreadList({ threads, channels, tags, selectedThreadId, onSelect, emptyHint }: Props) {
  const [authors, setAuthors] = useState<Map<string, { full_name: string | null; avatar_url?: string | null }>>(new Map());

  useEffect(() => {
    const ids = Array.from(new Set(threads.map((t) => t.author_id).filter(Boolean))) as string[];
    if (ids.length === 0) return;
    (async () => {
      const { data } = await sb.from("profiles").select("user_id, full_name, avatar_url").in("user_id", ids);
      setAuthors(new Map((data ?? []).map((p: any) => [p.user_id, { full_name: p.full_name, avatar_url: p.avatar_url }])));
    })();
  }, [threads.map((t) => t.author_id).join(",")]);

  if (threads.length === 0) {
    return (
      <div className="py-12 text-center text-xs text-muted-foreground/60">
        {emptyHint || "No threads yet."}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/40">
      {threads.map((t) => {
        const channel = channels.find((c) => c.id === t.channel_id);
        const tag = tags.find((x) => x.key === t.tag);
        const author = t.author_id ? authors.get(t.author_id) : undefined;
        const active = selectedThreadId === t.id;
        return (
          <li key={t.id}>
            <button
              onClick={() => onSelect(t.id)}
              className={cn(
                "w-full text-left px-3 py-2.5 hover:bg-muted/40 transition-colors",
                active && "bg-muted/60",
              )}
            >
              <div className="flex items-start gap-2.5">
                <UserAvatar name={author?.full_name} avatarUrl={author?.avatar_url} className="h-7 w-7 mt-0.5 shrink-0" fallbackClassName="text-[10px] bg-muted" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-sm truncate",
                      t.status === "resolved" ? "text-muted-foreground line-through" : "font-medium text-foreground",
                    )}>
                      {t.title}
                    </span>
                    {tag && <SyncTagBadge tag={tag} size="xs" />}
                    {t.status === "resolved" && (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" aria-label="resolved" />
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                    <span className="truncate">{channel?.displayName || ""}</span>
                    <span>·</span>
                    <span className="shrink-0">{relTime(t.last_activity_at)}</span>
                    {author?.full_name && (
                      <>
                        <span>·</span>
                        <span className="truncate">by {author.full_name}</span>
                      </>
                    )}
                  </div>
                  {t.body && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">{t.body}</p>
                  )}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
