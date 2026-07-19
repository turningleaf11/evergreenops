// CampaignsTab — the outreach log for a deal. Every send is a campaign record:
// what went out (channel, subject, copy), to whom, with per-recipient outcomes
// (sent / failed / skipped) and response attribution.
//
// Responses are NOT marked by hand — replies land in GHL, and a GHL
// "customer replied" workflow webhook will stamp responded_at + add the buyer
// to the deal's interest tracker automatically (webhook build pending). Until
// then the Responded chip simply stays empty.

import { useCallback, useEffect, useState } from "react";
import { Plus, Mail, MessageSquare, ChevronDown, ChevronRight, Megaphone, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { CampaignComposer } from "./CampaignComposer";

const dispo = supabase as unknown as { from: (table: string) => any };

interface Campaign {
  id: string;
  channel: string;
  name: string | null;
  subject: string | null;
  body: string;
  status: string;
  recipient_count: number | null;
  sent_count: number | null;
  failed_count: number | null;
  created_at: string;
  completed_at: string | null;
}

interface Recipient {
  id: string;
  buyer_id: string;
  status: string;
  error: string | null;
  sent_at: string | null;
  responded_at: string | null;
}

interface BuyerLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
}

function titleCase(s: string | null): string {
  if (!s) return "";
  return s.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
function buyerName(b: BuyerLite | undefined): string {
  if (!b) return "Unknown buyer";
  const full = `${titleCase(b.first_name)} ${titleCase(b.last_name)}`.trim();
  return full || b.company || "Unnamed buyer";
}

const STATUS_TONE: Record<string, string> = {
  sent: "text-brand-mint-deep bg-brand-mint/10",
  failed: "text-brand-coral bg-brand-coral/10",
  skipped: "text-muted-foreground bg-muted",
  pending: "text-brand-tangerine bg-brand-tangerine/10",
};

export interface CampaignDraft { subject: string; body: string }

export function CampaignsTab({
  transactionId,
  draft,
  onDraftConsumed,
  onCount,
}: {
  transactionId: string;
  draft?: CampaignDraft | null;
  onDraftConsumed?: () => void;
  onCount?: (n: number) => void;
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [respondedCounts, setRespondedCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [buyersById, setBuyersById] = useState<Map<string, BuyerLite>>(new Map());
  const [recipientsLoading, setRecipientsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await dispo
      .from("dispo_campaigns")
      .select("id, channel, name, subject, body, status, recipient_count, sent_count, failed_count, created_at, completed_at")
      .eq("transaction_id", transactionId)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(`Couldn't load campaigns: ${error.message}`);
      setLoading(false);
      return;
    }
    const rows = (data as Campaign[]) ?? [];
    setCampaigns(rows);
    onCount?.(rows.length);

    // Responded rollup across this deal's campaigns.
    if (rows.length) {
      const { data: recs } = await dispo
        .from("dispo_campaign_recipients")
        .select("campaign_id, responded_at")
        .in("campaign_id", rows.map((c) => c.id))
        .not("responded_at", "is", null);
      const counts: Record<string, number> = {};
      ((recs as any[]) ?? []).forEach((r) => {
        counts[r.campaign_id] = (counts[r.campaign_id] ?? 0) + 1;
      });
      setRespondedCounts(counts);
    } else {
      setRespondedCounts({});
    }
    setLoading(false);
  }, [transactionId]);

  useEffect(() => {
    void load();
  }, [load]);

  // An email pushed over from the AI copy generator opens the composer prefilled.
  useEffect(() => {
    if (draft) setComposerOpen(true);
  }, [draft]);

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setRecipientsLoading(true);
    const { data: recs } = await dispo
      .from("dispo_campaign_recipients")
      .select("id, buyer_id, status, error, sent_at, responded_at")
      .eq("campaign_id", id)
      .order("sent_at", { ascending: true, nullsFirst: false });
    const rows = (recs as Recipient[]) ?? [];
    setRecipients(rows);
    const ids = Array.from(new Set(rows.map((r) => r.buyer_id)));
    if (ids.length) {
      const { data: bs } = await dispo
        .from("dispo_buyers")
        .select("id, first_name, last_name, company")
        .in("id", ids);
      setBuyersById(new Map(((bs as BuyerLite[]) ?? []).map((b) => [b.id, b])));
    } else {
      setBuyersById(new Map());
    }
    setRecipientsLoading(false);
  }

  const newCampaignButton = (
    <Button size="sm" className="gap-1.5 h-8" onClick={() => setComposerOpen(true)}>
      <Plus className="h-3.5 w-3.5" /> New campaign
    </Button>
  );

  return (
    <section className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h3 className="crm-eyebrow">Campaigns</h3>
          {campaigns.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {campaigns.length} sent for this deal
            </span>
          )}
        </div>
        {newCampaignButton}
      </div>

      {loading ? (
        <div className="crm-card space-y-2">
          {[0, 1].map((i) => <div key={i} className="h-12 rounded-md bg-muted/40 animate-pulse" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            icon={Megaphone}
            title="No campaigns yet"
            description="Blast this deal to the buyers whose buy-box fits — filter by state, county, or city, pick exactly who gets it, and track who responds."
          />
          <div className="flex justify-center">{newCampaignButton}</div>
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c) => {
            const expanded = expandedId === c.id;
            const responded = respondedCounts[c.id] ?? 0;
            const Icon = c.channel === "sms" ? MessageSquare : Mail;
            return (
              <div key={c.id} className="crm-card !p-0 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleExpand(c.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                >
                  {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <Icon className="h-4 w-4 text-brand-azure shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-medium truncate leading-tight">
                      {c.name || c.subject || (c.channel === "sms" ? "SMS blast" : "Email blast")}
                    </span>
                    <span className="block text-[11px] text-muted-foreground leading-tight">
                      {format(new Date(c.created_at), "MMM d, yyyy · h:mm a")}
                    </span>
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                    {c.sent_count ?? 0} sent
                    {(c.failed_count ?? 0) > 0 && <span className="text-brand-coral"> · {c.failed_count} failed</span>}
                    {responded > 0 && <span className="text-brand-mint-deep font-medium"> · {responded} responded</span>}
                  </span>
                </button>

                {expanded && (
                  <div className="border-t border-border/40">
                    <div className="px-4 py-2.5 bg-muted/20 text-xs text-muted-foreground whitespace-pre-wrap border-b border-border/30">
                      {c.subject && <div className="font-medium text-foreground mb-1">{c.subject}</div>}
                      {c.body}
                    </div>
                    {recipientsLoading ? (
                      <div className="p-3 space-y-1.5">
                        {[0, 1, 2].map((i) => <div key={i} className="h-8 rounded bg-muted/40 animate-pulse" />)}
                      </div>
                    ) : (
                      <ul className="divide-y divide-border/30 max-h-72 overflow-y-auto">
                        {recipients.map((r) => (
                          <li key={r.id} className="flex items-center gap-3 px-4 py-2">
                            <span className="flex-1 min-w-0 text-[13px] truncate">{buyerName(buyersById.get(r.buyer_id))}</span>
                            {r.error && <span className="text-[10px] text-brand-coral truncate max-w-[160px]" title={r.error}>{r.error}</span>}
                            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded capitalize", STATUS_TONE[r.status] ?? STATUS_TONE.pending)}>
                              {r.status}
                            </span>
                            {r.responded_at && (
                              <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md text-brand-mint-deep bg-brand-mint/10 shrink-0">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Responded
                              </span>
                            )}
                          </li>
                        ))}
                        {recipients.length === 0 && (
                          <li className="px-4 py-6 text-center text-xs text-muted-foreground">No recipients recorded.</li>
                        )}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CampaignComposer
        transactionId={transactionId}
        open={composerOpen}
        onOpenChange={(v) => {
          setComposerOpen(v);
          if (!v && draft) onDraftConsumed?.();
        }}
        initialDraft={draft ?? null}
        onSent={load}
      />
    </section>
  );
}

export default CampaignsTab;
