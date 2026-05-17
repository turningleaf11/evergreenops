import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useSyncWorkspace, useSyncThreads, type ThreadFilters } from "@/hooks/useSync";
import { SyncChannelList } from "@/components/sync/SyncChannelList";
import { SyncThreadList } from "@/components/sync/SyncThreadList";
import { SyncThreadDetail } from "@/components/sync/SyncThreadDetail";
import { ComposeThreadDialog } from "@/components/sync/ComposeThreadDialog";

type View = { kind: "all" } | { kind: "needs_you" } | { kind: "channel"; channelId: string };

export default function SyncPage() {
  const { channelId, threadId } = useParams<{ channelId?: string; threadId?: string }>();
  const navigate = useNavigate();
  const { channels, tags, loading: workspaceLoading, refresh: refreshWorkspace } = useSyncWorkspace();

  const initialView: View = channelId ? { kind: "channel", channelId } : { kind: "all" };
  const [view, setView] = useState<View>(initialView);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved">("open");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(threadId || null);

  const filters: ThreadFilters = useMemo(() => {
    if (view.kind === "needs_you") return { view: "needs_you" };
    if (view.kind === "channel") return { view: "all", channelId: view.channelId, status: statusFilter, tag: tagFilter || undefined };
    return { view: "all", status: statusFilter, tag: tagFilter || undefined };
  }, [view, statusFilter, tagFilter]);

  const { threads, refresh: refreshThreads } = useSyncThreads(filters, tags);

  // Needs-you count for sidebar badge
  const { threads: needsYou } = useSyncThreads({ view: "needs_you" }, tags);

  // Sync URL with selection
  useEffect(() => {
    if (selectedThreadId) {
      navigate(`/sync/thread/${selectedThreadId}`, { replace: true });
    } else if (view.kind === "channel") {
      navigate(`/sync/${view.channelId}`, { replace: true });
    } else {
      navigate(`/sync`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedThreadId]);

  // When threadId comes in via URL, scope view to that thread's channel
  useEffect(() => {
    if (!threadId) return;
    setSelectedThreadId(threadId);
  }, [threadId]);

  const selectedThread = threads.find((t) => t.id === selectedThreadId) ||
    // Selected thread might not match current filters — fall back to any cached match
    null;

  // If selected thread isn't in the current filtered list, fetch it directly
  const [fallbackThread, setFallbackThread] = useState<any>(null);
  useEffect(() => {
    if (!selectedThreadId) { setFallbackThread(null); return; }
    const inList = threads.find((t) => t.id === selectedThreadId);
    if (inList) { setFallbackThread(null); return; }
    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const sb = supabase as any;
      const { data } = await sb.from("sync_threads").select("*").eq("id", selectedThreadId).maybeSingle();
      setFallbackThread(data || null);
    })();
  }, [selectedThreadId, threads]);

  const activeThread = selectedThread || fallbackThread;
  const activeChannel = activeThread ? channels.find((c) => c.id === activeThread.channel_id) : undefined;

  const channelForCompose = view.kind === "channel" ? view.channelId : null;

  const headerTitle =
    view.kind === "all" ? "All Threads"
    : view.kind === "needs_you" ? "Needs You"
    : channels.find((c) => c.id === view.channelId)?.displayName || "Channel";

  return (
    <div className="flex h-full min-h-0">
      {/* Left: channel list */}
      <aside className="w-60 shrink-0 border-r border-border/40 bg-background/40 overflow-y-auto p-3">
        <div className="flex items-center justify-between mb-3 px-1">
          <h1 className="text-sm font-semibold text-foreground">Sync</h1>
          <button
            onClick={() => setComposeOpen(true)}
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-3 w-3" /> New
          </button>
        </div>
        {workspaceLoading ? (
          <p className="text-xs text-muted-foreground/60 px-2">Loading…</p>
        ) : channels.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 px-2">No channels yet.</p>
        ) : (
          <SyncChannelList
            channels={channels}
            view={view}
            onSelect={(v) => { setView(v); setSelectedThreadId(null); }}
            needsYouCount={needsYou.length}
          />
        )}
      </aside>

      {/* Middle: thread list */}
      <section className="w-[26rem] shrink-0 min-h-0 border-r border-border/40 flex flex-col">
        <div className="px-4 py-3 border-b border-border/40 bg-card/30 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">{headerTitle}</h2>
            {view.kind !== "needs_you" && (
              <div className="flex items-center gap-1">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="text-[10px] bg-muted/40 border border-border/40 rounded px-1.5 py-0.5"
                >
                  <option value="open">Open</option>
                  <option value="resolved">Resolved</option>
                  <option value="all">All</option>
                </select>
                <select
                  value={tagFilter ?? ""}
                  onChange={(e) => setTagFilter(e.target.value || null)}
                  className="text-[10px] bg-muted/40 border border-border/40 rounded px-1.5 py-0.5"
                >
                  <option value="">All tags</option>
                  {tags.map((t) => (
                    <option key={t.key} value={t.key}>{t.emoji} {t.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <SyncThreadList
            threads={threads}
            channels={channels}
            tags={tags}
            selectedThreadId={selectedThreadId}
            onSelect={setSelectedThreadId}
            emptyHint={
              view.kind === "needs_you"
                ? "Nothing waiting on you. 🎉"
                : "No threads. Start one with the + button."
            }
          />
        </div>
      </section>

      {/* Right: detail */}
      <section className="flex-1 min-w-0 min-h-0 flex flex-col">
        {activeThread && activeChannel ? (
          <SyncThreadDetail
            key={activeThread.id}
            thread={activeThread}
            channel={activeChannel}
            tags={tags}
            onChanged={() => { refreshThreads(); refreshWorkspace(); }}
            onClose={() => setSelectedThreadId(null)}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground/60">
            Select a thread to open it.
          </div>
        )}
      </section>

      <ComposeThreadDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        channels={channels}
        tags={tags}
        defaultChannelId={channelForCompose}
        onCreated={(id) => {
          refreshThreads();
          setSelectedThreadId(id);
        }}
      />
    </div>
  );
}
