import { Link } from "react-router-dom";
import { Bell, ArrowRight, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useSyncWorkspace, useSyncThreads } from "@/hooks/useSync";
import { SyncTagBadge } from "./SyncTagBadge";
import { cn } from "@/lib/utils";

function relTime(iso: string) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return ""; }
}

/**
 * Compact Sync · Needs You preview, intended for the CEO cockpit Today tab.
 * Shows open tagged threads waiting on the current viewer.
 */
export function SyncNeedsYouPreview({ limit = 5 }: { limit?: number }) {
  const { tags, loading } = useSyncWorkspace();
  const { threads, loading: threadsLoading } = useSyncThreads({ view: "needs_you" }, tags);

  if (loading || threadsLoading) return null;

  const showThreads = threads.slice(0, limit);
  const remaining = Math.max(0, threads.length - showThreads.length);

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 elevation-1 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/40 bg-gradient-to-r from-primary/[0.04] to-transparent flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sync · Needs You</h2>
          {threads.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-medium">
              {threads.length}
            </span>
          )}
        </div>
        <Link to="/sync" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
          Open <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {threads.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-1.5" />
          <p className="text-xs text-muted-foreground/70">Nothing waiting on you. 🎉</p>
        </div>
      ) : (
        <ul className="divide-y divide-border/30">
          {showThreads.map((t) => {
            const tag = tags.find((x) => x.key === t.tag);
            return (
              <li key={t.id}>
                <Link
                  to={`/sync/thread/${t.id}`}
                  className="block px-4 py-2.5 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-sm truncate flex-1 text-foreground font-medium")}>
                      {t.title}
                    </span>
                    {tag && <SyncTagBadge tag={tag} size="xs" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">{relTime(t.last_activity_at)}</p>
                </Link>
              </li>
            );
          })}
          {remaining > 0 && (
            <li>
              <Link to="/sync" className="block px-4 py-2 text-[11px] text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors text-center">
                +{remaining} more in Sync
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
