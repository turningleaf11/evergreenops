import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Inbox, Send, Star, FileText, Loader2, RefreshCw, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useGmailAccess } from "@/hooks/useGmailAccess";
import { supabase } from "@/integrations/supabase/client";
import { ComposeModal } from "@/components/inbox/ComposeModal";
import { ThreadDetail } from "@/components/inbox/ThreadDetail";

interface ThreadSummary {
  id: string;
  snippet: string;
  subject: string;
  from: string;
  date: string;
  messageCount: number;
  unread: boolean;
  labelIds: string[];
}

const FOLDERS = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "starred", label: "Starred", icon: Star },
  { id: "sent", label: "Sent", icon: Send },
  { id: "drafts", label: "Drafts", icon: FileText },
];

export default function InboxPage() {
  const { loading: accessLoading, connected, hasAccess, isAdmin } = useGmailAccess();
  const [folder, setFolder] = useState("inbox");
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  const load = async () => {
    if (!hasAccess) return;
    setLoading(true);
    const params = new URLSearchParams({ folder });
    if (search) params.set("q", search);
    const { data, error } = await supabase.functions.invoke(`gmail-list-threads?${params}`, {
      method: "GET",
    } as any);
    if (!error && data?.threads) setThreads(data.threads);
    setLoading(false);
  };

  useEffect(() => {
    if (hasAccess) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess, folder]);

  const headerTitle = useMemo(() => FOLDERS.find((f) => f.id === folder)?.label ?? "Inbox", [folder]);

  if (accessLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!connected) {
    return (
      <EmptyState
        title="Gmail isn't connected yet"
        body={isAdmin
          ? "Connect a workspace Gmail account to enable the team inbox."
          : "Ask an admin to connect Gmail for your workspace."}
        cta={isAdmin ? <Link to="/settings/integrations/gmail"><Button>Connect Gmail</Button></Link> : null}
      />
    );
  }

  if (!hasAccess) {
    return (
      <EmptyState
        title="No access to the team inbox"
        body="Your admin hasn't granted you access to the workspace Gmail account."
      />
    );
  }

  return (
    <div className="h-[calc(100vh-60px)] flex">
      {/* Folder sidebar */}
      <aside className="w-52 border-r border-border/30 p-3 flex flex-col gap-1 shrink-0 bg-card/30">
        <Button onClick={() => setComposeOpen(true)} className="mb-3 justify-start gap-2" size="sm">
          <Pencil className="h-4 w-4" /> Compose
        </Button>
        {FOLDERS.map((f) => {
          const Icon = f.icon;
          return (
            <button
              key={f.id}
              onClick={() => { setFolder(f.id); setSelectedId(null); }}
              className={cn(
                "flex items-center gap-2 px-2.5 py-2 rounded-md text-sm transition-colors text-left",
                folder === f.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {f.label}
            </button>
          );
        })}
      </aside>

      {/* Thread list */}
      <section className={cn("flex flex-col border-r border-border/30 shrink-0", selectedId ? "w-96" : "flex-1")}>
        <div className="p-3 border-b border-border/30 flex items-center gap-2">
          <h2 className="text-sm font-semibold">{headerTitle}</h2>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Search…"
            className="h-7 text-xs flex-1"
          />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={load}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
        <div className="flex-1 overflow-auto">
          {loading && threads.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Loading…</div>
          ) : threads.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">No messages</div>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={cn(
                  "w-full text-left px-3 py-2.5 border-b border-border/20 hover:bg-muted/40 transition-colors",
                  selectedId === t.id && "bg-muted/60",
                  t.unread && "font-medium"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs truncate flex-1">{cleanFrom(t.from)}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{shortDate(t.date)}</span>
                </div>
                <div className="text-xs truncate">{t.subject}</div>
                <div className="text-[11px] text-muted-foreground truncate">{t.snippet}</div>
              </button>
            ))
          )}
        </div>
      </section>

      {/* Thread detail */}
      {selectedId && (
        <section className="flex-1 overflow-auto">
          <ThreadDetail
            threadId={selectedId}
            onClose={() => setSelectedId(null)}
            onReply={() => setComposeOpen(true)}
            onMutated={load}
          />
        </section>
      )}

      <ComposeModal open={composeOpen} onOpenChange={setComposeOpen} onSent={load} />
    </div>
  );
}

function EmptyState({ title, body, cta }: { title: string; body: string; cta?: React.ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-3">
        <div className="h-12 w-12 rounded-xl bg-primary/10 mx-auto flex items-center justify-center">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{body}</p>
        {cta}
      </div>
    </div>
  );
}

function cleanFrom(from: string) {
  const m = from.match(/^([^<]+)</);
  return (m ? m[1] : from).trim().replace(/^"|"$/g, "");
}

function shortDate(d: string) {
  if (!d) return "";
  const date = new Date(d);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
