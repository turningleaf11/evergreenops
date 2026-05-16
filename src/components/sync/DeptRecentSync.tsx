import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MessagesSquare, ArrowRight, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { SyncTagBadge } from "./SyncTagBadge";
import type { SyncTag, SyncThread } from "@/hooks/useSync";
import { cn } from "@/lib/utils";

const sb = supabase as any;

function relTime(iso: string) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return ""; }
}

interface Props {
  /** Filter to threads where one of the channel members is a leader of this dept. */
  deptId: string;
  /** Optional cap; default 5 */
  limit?: number;
}

/**
 * Shows recent Sync threads the viewer is a member of that involve this department —
 * i.e. threads in channels where one of the other members is a leader of this dept.
 *
 * Used on the dept page's Leadership tab as a preview of ongoing 2-way CEO/leader comms.
 */
export function DeptRecentSync({ deptId, limit = 5 }: Props) {
  const { user } = useAuth();
  const [threads, setThreads] = useState<SyncThread[]>([]);
  const [tags, setTags] = useState<SyncTag[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      // 1. Leaders of this dept (anyone in profiles with dept_id + is_leader, or admin)
      const { data: deptLeaders } = await sb
        .from("profiles")
        .select("user_id")
        .eq("department_id", deptId)
        .eq("is_leader", true);
      const leaderIds = new Set<string>((deptLeaders ?? []).map((r: any) => r.user_id));

      // 2. Channels the viewer is a member of
      const { data: myMemberships } = await sb
        .from("sync_channel_members")
        .select("channel_id")
        .eq("user_id", user.id);
      const channelIds: string[] = (myMemberships ?? []).map((r: any) => r.channel_id);
      if (channelIds.length === 0) { setLoaded(true); return; }

      // 3. Members across those channels — narrow to channels that also include a dept leader
      const { data: allMembers } = await sb
        .from("sync_channel_members")
        .select("channel_id, user_id")
        .in("channel_id", channelIds);
      const relevantChannelIds = Array.from(new Set(
        (allMembers ?? [])
          .filter((m: any) => leaderIds.has(m.user_id))
          .map((m: any) => m.channel_id),
      )) as string[];

      if (relevantChannelIds.length === 0) { setLoaded(true); return; }

      const [{ data: threadRows }, { data: tagRows }] = await Promise.all([
        sb.from("sync_threads")
          .select("*")
          .in("channel_id", relevantChannelIds)
          .order("last_activity_at", { ascending: false })
          .limit(limit),
        sb.from("sync_tags").select("*").order("sort_order"),
      ]);
      if (cancelled) return;
      setThreads(((threadRows ?? []) as any[]).map((t) => ({
        ...t,
        linked_items: Array.isArray(t.linked_items) ? t.linked_items : [],
        converted_project_id: t.converted_project_id ?? null,
      })) as SyncThread[]);
      setTags(tagRows ?? []);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [user, deptId, limit]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <MessagesSquare className="h-4 w-4" /> Recent in Sync
        </h2>
        <Link to="/sync" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          Open Sync <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {!loaded ? (
        <p className="text-xs text-muted-foreground/60 px-1 py-2">Loading…</p>
      ) : threads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/40 p-5 text-center">
          <p className="text-xs text-muted-foreground/70">No active threads with this dept yet.</p>
          <Link to="/sync" className="inline-block mt-2 text-xs text-primary hover:underline">Start one in Sync →</Link>
        </div>
      ) : (
        <ul className="divide-y divide-border/40 rounded-lg border border-border/40 bg-card/40 overflow-hidden">
          {threads.map((t) => {
            const tag = tags.find((x) => x.key === t.tag);
            return (
              <li key={t.id}>
                <Link
                  to={`/sync/thread/${t.id}`}
                  className="block px-3 py-2.5 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      "text-sm truncate flex-1",
                      t.status === "resolved" ? "text-muted-foreground line-through" : "text-foreground font-medium",
                    )}>
                      {t.title}
                    </span>
                    {tag && <SyncTagBadge tag={tag} size="xs" />}
                    {t.status === "resolved" && (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">{relTime(t.last_activity_at)}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
