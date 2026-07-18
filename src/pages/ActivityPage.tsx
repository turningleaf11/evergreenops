// ActivityPage — the unified event surface. One backbone (events table), two
// views: Inbox (needs_action & unresolved) and Feed (everything). Team-wide.
// Events are emitted by the app (deal published, campaign sent, site inquiry…)
// and by external systems via the event-ingest webhook (e.g. Zapier failures).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  Inbox, Rss, RefreshCw, CheckCheck, Check, Mail, HandCoins, UserPlus,
  Megaphone, Globe, AlertTriangle, Zap, Circle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ev = supabase as unknown as { from: (t: string) => any };

interface EventRow {
  id: string;
  type: string;
  severity: "info" | "success" | "warning" | "error";
  title: string;
  body: string | null;
  source: string | null;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  actor: string | null;
  needs_action: boolean;
  read_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

const SEV_DOT: Record<string, string> = {
  info: "bg-brand-azure",
  success: "bg-brand-mint",
  warning: "bg-brand-tangerine",
  error: "bg-brand-coral",
};

const TYPE_ICON: Record<string, any> = {
  site_inquiry: HandCoins,
  buyers_list_signup: UserPlus,
  lead_error: AlertTriangle,
  campaign_sent: Megaphone,
  deal_published: Globe,
  zap_failure: Zap,
  external: Zap,
};

export default function ActivityPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"inbox" | "feed">("inbox");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await ev
      .from("events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) toast.error(`Couldn't load activity: ${error.message}`);
    setRows((data as EventRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Live updates when the events table is in the realtime publication.
  useEffect(() => {
    const ch = supabase
      .channel("events-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [load]);

  const inbox = useMemo(() => rows.filter((r) => r.needs_action && !r.resolved_at), [rows]);
  const unreadCount = useMemo(() => rows.filter((r) => !r.read_at).length, [rows]);

  async function resolve(id: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, resolved_at: new Date().toISOString(), read_at: r.read_at ?? new Date().toISOString() } : r)));
    await ev.from("events").update({ resolved_at: new Date().toISOString(), resolved_by: user?.id ?? null, read_at: new Date().toISOString() }).eq("id", id);
  }

  async function markAllRead() {
    const ids = rows.filter((r) => !r.read_at).map((r) => r.id);
    if (!ids.length) return;
    const now = new Date().toISOString();
    setRows((prev) => prev.map((r) => (r.read_at ? r : { ...r, read_at: now })));
    await ev.from("events").update({ read_at: now }).in("id", ids);
  }

  function openEntity(r: EventRow) {
    if (r.entity_type === "deal") navigate("/crm/deals");
    else if (r.entity_type === "buyer") navigate("/crm/deals");
  }

  const list = tab === "inbox" ? inbox : rows;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">Activity</h1>
          <p className="text-sm text-muted-foreground">Everything that needs attention, and everything that happened.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={markAllRead} disabled={unreadCount === 0} className="gap-1.5">
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => load()} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "inbox" | "feed")}>
        <TabsList>
          <TabsTrigger value="inbox" className="gap-1.5">
            <Inbox className="h-4 w-4" /> Inbox
            {inbox.length > 0 && (
              <span className="ml-1 rounded-full bg-brand-coral text-white text-[10px] font-semibold px-1.5 min-w-[18px] text-center">{inbox.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="feed" className="gap-1.5"><Rss className="h-4 w-4" /> Feed</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />)}</div>
          ) : list.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 p-12 text-center">
              <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-muted grid place-items-center text-muted-foreground">
                {tab === "inbox" ? <Check className="h-5 w-5" /> : <Rss className="h-5 w-5" />}
              </div>
              <p className="font-medium">{tab === "inbox" ? "Inbox zero" : "No activity yet"}</p>
              <p className="text-sm text-muted-foreground">{tab === "inbox" ? "Nothing needs your attention right now." : "Events will show up here as things happen."}</p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {list.map((r) => {
                const Icon = TYPE_ICON[r.type] ?? Circle;
                const unread = !r.read_at;
                return (
                  <li
                    key={r.id}
                    className={cn(
                      "group flex items-start gap-3 rounded-lg border p-3 transition-colors",
                      unread ? "border-brand-azure/30 bg-brand-azure/[0.03]" : "border-border/60 bg-card",
                    )}
                  >
                    <span className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", SEV_DOT[r.severity] ?? "bg-muted")} />
                    <Icon className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("text-sm", unread && "font-semibold")}>{r.title}</span>
                        {r.entity_label && (
                          <button
                            type="button"
                            onClick={() => openEntity(r)}
                            className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:text-brand-azure truncate max-w-[180px]"
                          >
                            {r.entity_label}
                          </button>
                        )}
                      </div>
                      {r.body && <p className="text-[13px] text-muted-foreground mt-0.5 line-clamp-2">{r.body}</p>}
                      <div className="text-[11px] text-muted-foreground/70 mt-1 flex items-center gap-2">
                        <span>{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                        {r.source && <span>· {r.source}</span>}
                        {r.actor && <span>· {r.actor}</span>}
                      </div>
                    </div>
                    {r.needs_action && !r.resolved_at && (
                      <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => resolve(r.id)}>
                        <Check className="h-3.5 w-3.5" /> Resolve
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
