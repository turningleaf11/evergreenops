import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Loader2, RefreshCw, CheckCircle2, SkipForward,
  ChevronDown, ChevronUp, UserCheck, Home, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type ReviewItem = {
  id: string;
  ghl_contact_id: string;
  contact_name: string;
  contact_type: string;
  phone: string | null;
  current_status_label: string;
  current_status_tag: string;
  suggested_status_label: string;
  suggested_status_tag: string;
  confidence: number;
  reasoning: string;
  conversation_snippet: Array<{ direction: string; body: string; date: string }>;
  review_status: string;
  created_at: string;
};

type BatchInfo = {
  id: string;
  status: string;
  contacts_fetched: number;
  contacts_queued: number;
  contacts_skipped: number;
  error: string | null;
  started_at: string;
  completed_at: string | null;
};

type FilterType = "all" | "seller_lead" | "realtor" | "high_conf";

const FILTER_LABELS: Record<FilterType, string> = {
  all:         "All",
  seller_lead: "Seller Leads",
  realtor:     "Realtors",
  high_conf:   "≥ 90% Confidence",
};

function confidenceColor(c: number) {
  if (c >= 0.9) return "text-emerald-600 dark:text-emerald-400";
  if (c >= 0.7) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

function relTime(iso: string) {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`;
  return `${Math.round(diff / 1440)}d ago`;
}

export function LeadReviewTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [lastBatch, setLastBatch] = useState<BatchInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [batching, setBatching] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actioning, setActioning] = useState<Set<string>>(new Set());

  const loadQueue = useCallback(async () => {
    setLoading(true);
    const [{ data: queueData }, { data: batchData }] = await Promise.all([
      supabase
        .from("contact_review_queue")
        .select("*")
        .eq("review_status", "pending")
        .order("confidence", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("contact_review_batches")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setItems((queueData ?? []) as ReviewItem[]);
    setLastBatch(batchData as BatchInfo | null);
    setLoading(false);
  }, []);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const runBatch = async () => {
    setBatching(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const supabaseUrl = (supabase as any).supabaseUrl as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/contact-review-batch`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: (supabase as any).supabaseKey as string,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ triggeredBy: "manual", limit: 150 }),
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        toast({ title: "Batch failed", description: result.error ?? "Unknown error", variant: "destructive" });
      } else {
        toast({
          title: "Batch complete",
          description: `${result.contactsQueued} contacts queued for review`,
        });
        await loadQueue();
      }
    } catch (e: any) {
      toast({ title: "Batch failed", description: e.message, variant: "destructive" });
    } finally {
      setBatching(false);
    }
  };

  const action = async (itemId: string, act: "approve" | "skip") => {
    setActioning((s) => new Set(s).add(itemId));
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const supabaseUrl = (supabase as any).supabaseUrl as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/contact-review-apply`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: (supabase as any).supabaseKey as string,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ queueItemId: itemId, userId: user?.id, action: act }),
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        toast({ title: "Action failed", description: result.error ?? "Unknown error", variant: "destructive" });
      } else {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        if (act === "approve") {
          toast({ title: "Applied", description: "Status updated in GHL" });
        }
      }
    } catch (e: any) {
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
    } finally {
      setActioning((s) => { const n = new Set(s); n.delete(itemId); return n; });
    }
  };

  const bulkApproveHighConf = async () => {
    const highConf = filteredItems.filter((i) => i.confidence >= 0.9);
    for (const item of highConf) {
      await action(item.id, "approve");
    }
  };

  const filteredItems = items.filter((i) => {
    if (filter === "seller_lead") return i.contact_type === "seller_lead";
    if (filter === "realtor") return i.contact_type === "realtor";
    if (filter === "high_conf") return i.confidence >= 0.9;
    return true;
  });

  const highConfCount = items.filter((i) => i.confidence >= 0.9).length;
  const sellerCount = items.filter((i) => i.contact_type === "seller_lead").length;
  const realtorCount = items.filter((i) => i.contact_type === "realtor").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Lead Review Queue</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI-suggested status updates for seller leads and realtors
          </p>
          {lastBatch && (
            <div className="text-xs text-muted-foreground/60 mt-1 space-y-0.5">
              <p>
                Last batch {relTime(lastBatch.started_at)}
                {lastBatch.status === "completed" && ` · ${lastBatch.contacts_queued} queued · ${lastBatch.contacts_fetched} fetched`}
                {lastBatch.status === "failed" && (
                  <span className="text-destructive"> · failed: {lastBatch.error}</span>
                )}
                {lastBatch.status === "running" && " · running…"}
              </p>
              {lastBatch.status === "completed" && lastBatch.contacts_queued === 0 && lastBatch.error && (
                <p className="text-muted-foreground/50 italic">{lastBatch.error}</p>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {highConfCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={bulkApproveHighConf}
              className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve all ≥ 90% ({highConfCount})
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={runBatch}
            disabled={batching}
            className="gap-1.5"
          >
            {batching
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5" />}
            {batching ? "Running…" : "Run Batch"}
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {(Object.keys(FILTER_LABELS) as FilterType[]).map((f) => {
          const count = f === "all" ? items.length
            : f === "seller_lead" ? sellerCount
            : f === "realtor" ? realtorCount
            : highConfCount;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
            >
              {FILTER_LABELS[f]}
              <span className={cn("ml-1.5 tabular-nums", filter === f ? "opacity-70" : "opacity-50")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Missing API key warning */}
      {lastBatch?.error?.includes("ANTHROPIC_API_KEY") && (
        <div className="rounded-lg border border-amber-200/50 bg-amber-50/10 p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
            <strong>Setup required:</strong> Add <code className="bg-muted/60 px-1 rounded text-[10px]">ANTHROPIC_API_KEY</code> to
            your Supabase project secrets (Settings → Edge Functions → Secrets).
          </p>
        </div>
      )}

      {/* Queue */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading queue…
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-border/40 bg-card/40 py-12 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">Queue is clear</p>
          <p className="text-xs text-muted-foreground mt-1">
            {items.length === 0
              ? "Run a batch to populate the review queue."
              : "No items match this filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => {
            const isExpanded = expandedId === item.id;
            const isActioning = actioning.has(item.id);
            const isSeller = item.contact_type === "seller_lead";

            return (
              <div
                key={item.id}
                className="rounded-xl border border-border/40 bg-card/50 overflow-hidden"
              >
                {/* Main row */}
                <div className="flex items-start gap-4 p-4">
                  {/* Contact info */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground truncate">
                        {item.contact_name}
                      </span>
                      <span className={cn(
                        "inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                        isSeller
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                          : "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
                      )}>
                        {isSeller ? <Home className="h-2.5 w-2.5" /> : <UserCheck className="h-2.5 w-2.5" />}
                        {isSeller ? "Seller Lead" : "Realtor"}
                      </span>
                      {item.phone && (
                        <span className="text-[11px] text-muted-foreground/60">{item.phone}</span>
                      )}
                    </div>

                    {/* Status change */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="px-2 py-0.5 rounded bg-muted/60 text-muted-foreground font-medium">
                        {item.current_status_label}
                      </span>
                      <span className="text-muted-foreground/40">→</span>
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                        {item.suggested_status_label}
                      </span>
                      <span className={cn("font-semibold tabular-nums", confidenceColor(item.confidence))}>
                        {Math.round(item.confidence * 100)}%
                      </span>
                    </div>

                    {/* Reasoning */}
                    <p className="text-[11px] text-muted-foreground/70 leading-relaxed line-clamp-2">
                      {item.reasoning}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => action(item.id, "approve")}
                      disabled={isActioning}
                      className="gap-1.5 h-8 text-xs"
                    >
                      {isActioning
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <CheckCircle2 className="h-3 w-3" />}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => action(item.id, "skip")}
                      disabled={isActioning}
                      className="gap-1.5 h-8 text-xs text-muted-foreground"
                    >
                      <SkipForward className="h-3 w-3" />
                      Skip
                    </Button>
                    {item.conversation_snippet.length > 0 && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors mt-1"
                      >
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        Convo
                      </button>
                    )}
                  </div>
                </div>

                {/* Conversation snippet (expandable) */}
                {isExpanded && item.conversation_snippet.length > 0 && (
                  <div className="border-t border-border/30 bg-muted/20 px-4 py-3 space-y-2">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/50 mb-2">
                      Recent Conversation
                    </p>
                    {item.conversation_snippet.map((msg, i) => (
                      <div key={i} className={cn("flex gap-2", msg.direction === "contact" ? "justify-start" : "justify-end")}>
                        <div className={cn(
                          "max-w-[80%] rounded-lg px-3 py-1.5 text-xs leading-relaxed",
                          msg.direction === "contact"
                            ? "bg-muted text-foreground"
                            : "bg-primary/10 text-primary",
                        )}>
                          {msg.body}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
