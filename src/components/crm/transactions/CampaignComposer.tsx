// CampaignComposer — dispo outreach campaigns: matching suggests, a person decides.
//
// Two steps:
//   1. Audience — the full buyer list, buy-box matches surfaced first with score
//      chips, filterable by state / county / city / tier. The dispo person
//      checks exactly who receives the send.
//   2. Message — pick a saved template or write fresh (optionally saving it as a
//      new template). Merge fields: {{first_name}} fills per-buyer at send time;
//      {{address}} {{city}} {{county}} {{state}} {{price}} fill from the deal.
//
// One mechanism regardless of audience size — OpsHQ decides, GHL delivers:
// the enroll-campaign function stamps each buyer's GHL contact with the merged
// copy and enrolls them in the "Dispo Blast" GHL workflow, which does the
// actual sending with GHL's native infra (throttle, DND/opt-outs, replies).
// Every send is recorded as a dispo_campaigns row with per-recipient outcomes
// — see CampaignsTab for the log; replies auto-attribute via ghl-reply-webhook.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Send, Loader2, Mail, MessageSquare, ArrowLeft, ArrowRight, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { US_STATES } from "@/lib/dealVocab";
import { logEvent } from "@/lib/events";
import { fmtMoney } from "./utils";

const dispo = supabase as unknown as {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

interface TxLite {
  property_address: string | null;
  property_city: string | null;
  property_state: string | null;
  property_county_metro: string | null;
  purchase_price: number | null;
  asking_price: number | null;
}

interface BuyerRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  tier: string | null;
  states: string[] | null;
  county_metro: string[] | null;
  markets: string[] | null;
}

interface Template {
  id: string;
  name: string;
  channel: string;
  subject: string | null;
  body: string;
}

function titleCase(s: string | null): string {
  if (!s) return "";
  return s.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
function buyerName(b: BuyerRow): string {
  const full = `${titleCase(b.first_name)} ${titleCase(b.last_name)}`.trim();
  return full || b.company || b.email || "Unnamed buyer";
}

// Deal-level merge fields resolve once, at campaign creation. {{first_name}}
// stays literal — the send function fills it per recipient.
function fillDealFields(t: string, tx: TxLite | null): string {
  if (!tx) return t;
  const price = tx.purchase_price ?? tx.asking_price;
  return (t || "")
    .replace(/\{\{\s*address\s*\}\}/gi, tx.property_address ?? "")
    .replace(/\{\{\s*city\s*\}\}/gi, tx.property_city ?? "")
    .replace(/\{\{\s*state\s*\}\}/gi, tx.property_state ?? "")
    .replace(/\{\{\s*county\s*\}\}/gi, tx.property_county_metro ?? "")
    .replace(/\{\{\s*price\s*\}\}/gi, price != null ? fmtMoney(price) : "");
}

const MERGE_CHIPS = ["{{first_name}}", "{{address}}", "{{city}}", "{{county}}", "{{state}}", "{{price}}"];

export function CampaignComposer({
  transactionId,
  open,
  onOpenChange,
  onSent,
  initialDraft,
}: {
  transactionId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSent?: () => void;
  initialDraft?: { subject: string; body: string } | null;
}) {
  const { user } = useAuth();

  const [step, setStep] = useState<"audience" | "message">("audience");
  const [tx, setTx] = useState<TxLite | null>(null);
  const [buyers, setBuyers] = useState<BuyerRow[]>([]);
  const [matchInfo, setMatchInfo] = useState<Map<string, { score: number; reasons: string[] }>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Audience filters
  const [matchedOnly, setMatchedOnly] = useState(true);
  const [stateF, setStateF] = useState<string>("");
  const [countyF, setCountyF] = useState("");
  const [cityF, setCityF] = useState("");
  const [nameF, setNameF] = useState("");

  // Message
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [txRes, buyersRes, matchRes, tplRes] = await Promise.all([
      dispo
        .from("crm_transactions")
        .select("property_address, property_city, property_state, property_county_metro, purchase_price, asking_price")
        .eq("id", transactionId)
        .maybeSingle(),
      dispo
        .from("dispo_buyers")
        .select("id, first_name, last_name, company, email, phone, tier, states, county_metro, markets")
        .order("updated_at", { ascending: false }),
      dispo.rpc("match_buyers_for_deal", { p_transaction_id: transactionId, p_min_score: 1 }),
      dispo.from("dispo_templates").select("id, name, channel, subject, body").order("created_at", { ascending: false }),
    ]);
    setTx((txRes.data as TxLite) ?? null);
    setBuyers((buyersRes.data as BuyerRow[]) ?? []);
    const mm = new Map<string, { score: number; reasons: string[] }>();
    ((matchRes.data as any[]) ?? []).forEach((m) => mm.set(m.buyer_id, { score: m.score, reasons: m.reasons ?? [] }));
    setMatchInfo(mm);
    setTemplates((tplRes.data as Template[]) ?? []);
    // Matching suggests: preselect the matches; the person adjusts from there.
    setSelected(new Set(mm.keys()));
    setLoading(false);
  }, [transactionId]);

  useEffect(() => {
    if (open) {
      setStep("audience");
      void load();
      // An AI-generated email arrives fully written — prefill it as an email
      // send. The person still picks the audience first, then reviews the copy.
      if (initialDraft) {
        setChannel("email");
        setTemplateId("");
        setSubject(initialDraft.subject ?? "");
        setBody(initialDraft.body ?? "");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, load]);

  const filtered = useMemo(() => {
    const county = countyF.trim().toLowerCase();
    const city = cityF.trim().toLowerCase();
    const name = nameF.trim().toLowerCase();
    const list = buyers.filter((b) => {
      if (matchedOnly && !matchInfo.has(b.id)) return false;
      if (stateF) {
        const states = (b.states ?? []).map((s) => s.toLowerCase());
        if (!states.includes(stateF.toLowerCase()) && !states.includes("nationwide")) return false;
      }
      if (county && !(b.county_metro ?? []).some((c) => c.toLowerCase().includes(county))) return false;
      if (city && !(b.markets ?? []).some((m) => m.toLowerCase().includes(city))) return false;
      if (name && !`${buyerName(b)} ${b.company ?? ""} ${b.email ?? ""}`.toLowerCase().includes(name)) return false;
      return true;
    });
    // Matches first, best score first; then the rest.
    return list.sort((a, b) => (matchInfo.get(b.id)?.score ?? -1) - (matchInfo.get(a.id)?.score ?? -1));
  }, [buyers, matchInfo, matchedOnly, stateF, countyF, cityF, nameF]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((b) => selected.has(b.id));

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((b) => next.delete(b.id));
      else filtered.forEach((b) => next.add(b.id));
      return next;
    });
  }

  function applyTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) {
      setSubject(t.subject ?? "");
      setBody(t.body);
      if (t.channel === "email" || t.channel === "sms") setChannel(t.channel);
    }
  }

  async function launch() {
    if (!body.trim()) return toast.error("Add a message first");
    if (channel === "email" && !subject.trim()) return toast.error("Add a subject line");
    if (selected.size === 0) return toast.error("Select at least one buyer");
    if (saveAsTemplate && !templateName.trim()) return toast.error("Name the template");

    const finalSubject = fillDealFields(subject.trim(), tx);
    const finalBody = fillDealFields(body.trim(), tx);
    const count = selected.size;

    const ok = window.confirm(
      `Send this ${channel === "email" ? "email" : "SMS"} to ${count} buyer${count === 1 ? "" : "s"}?\n\nEach buyer is enrolled in your GHL "Dispo Blast" workflow, which does the actual sending (opt-outs and DND are respected). This sends real messages.`,
    );
    if (!ok) return;

    setSending(true);
    try {
      let tplId: string | null = templateId || null;
      if (saveAsTemplate) {
        const { data: tpl, error: tErr } = await dispo
          .from("dispo_templates")
          .insert({
            name: templateName.trim(),
            channel,
            subject: channel === "email" ? subject.trim() : null,
            body: body.trim(), // templates keep the merge fields, not the filled values
            created_by: user?.id ?? null,
          })
          .select("id")
          .single();
        if (tErr) throw new Error(tErr.message);
        tplId = tpl.id;
      }

      const { data: campaign, error: cErr } = await dispo
        .from("dispo_campaigns")
        .insert({
          transaction_id: transactionId,
          channel,
          name: templateName.trim() || templates.find((t) => t.id === templateId)?.name || null,
          template_id: tplId,
          subject: channel === "email" ? finalSubject : null,
          body: finalBody,
          status: "draft",
          audience: "matched",
          recipient_count: count,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (cErr || !campaign) throw new Error(cErr?.message || "Couldn't create campaign");

      const ids = Array.from(selected);
      // Chunk the recipient insert to keep payloads sane at large counts.
      for (let i = 0; i < ids.length; i += 500) {
        const { error: rErr } = await dispo.from("dispo_campaign_recipients").insert(
          ids.slice(i, i + 500).map((bid) => ({ campaign_id: campaign.id, buyer_id: bid, status: "pending" })),
        );
        if (rErr) throw new Error(rErr.message);
      }

      let remaining = count;
      let totalSent = 0;
      let totalOther = 0;
      let guard = 0;
      while (remaining > 0 && guard < 400) {
        guard++;
        const { data, error } = await supabase.functions.invoke("enroll-campaign", {
          body: { campaign_id: campaign.id },
        });
        if (error) throw new Error(error.message);
        const d = (data ?? {}) as { sent?: number; failed?: number; remaining?: number; error?: string };
        if (d.error) throw new Error(d.error);
        totalSent += d.sent ?? 0;
        totalOther += d.failed ?? 0;
        remaining = d.remaining ?? 0;
      }

      toast.success(
        `Enrolled ${totalSent} buyer${totalSent === 1 ? "" : "s"} — GHL is sending the ${channel === "email" ? "emails" : "SMS"}` +
          (totalOther ? ` · ${totalOther} skipped/failed` : ""),
      );
      void logEvent({
        type: "campaign_sent",
        severity: "info",
        title: `${channel === "email" ? "Email" : "SMS"} campaign sent to ${totalSent} buyer${totalSent === 1 ? "" : "s"}`,
        body: [tx?.property_address, tx?.property_city].filter(Boolean).join(", ") || undefined,
        source: "opshq",
        entityType: "deal",
        entityId: transactionId,
        entityLabel: tx?.property_address ?? tx?.property_city ?? null,
        actor: user?.email ?? null,
        metadata: { channel, sent: totalSent, skipped: totalOther },
      });
      setSubject("");
      setBody("");
      setTemplateId("");
      setSaveAsTemplate(false);
      setTemplateName("");
      onOpenChange(false);
      onSent?.();
    } catch (e: any) {
      toast.error(e?.message || "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !sending && onOpenChange(v)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {step === "audience" ? "New campaign — choose the audience" : "New campaign — write the message"}
          </DialogTitle>
        </DialogHeader>

        {step === "audience" ? (
          <div className="space-y-3">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={nameF} onChange={(e) => setNameF(e.target.value)} placeholder="Search name…" className="h-8 pl-8 w-40 text-xs" />
              </div>
              <Select value={stateF || "any"} onValueChange={(v) => setStateF(v === "any" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs w-[150px]"><SelectValue placeholder="Any state" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="any">Any state</SelectItem>
                  {US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={countyF} onChange={(e) => setCountyF(e.target.value)} placeholder="County/metro…" className="h-8 w-36 text-xs" />
              <Input value={cityF} onChange={(e) => setCityF(e.target.value)} placeholder="City…" className="h-8 w-32 text-xs" />
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto cursor-pointer">
                <Switch checked={matchedOnly} onCheckedChange={setMatchedOnly} />
                Matched only
              </label>
            </div>

            {/* Buyer list */}
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => <div key={i} className="h-10 rounded-md bg-muted/40 animate-pulse" />)}
              </div>
            ) : (
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 border-b border-border/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Checkbox checked={allFilteredSelected} onCheckedChange={toggleAllFiltered} aria-label="Select all filtered" />
                  <span className="flex-1">Buyer</span>
                  <span className="w-48">Focus</span>
                  <span className="w-20 text-right">Match</span>
                </div>
                <div className="max-h-[42vh] overflow-y-auto divide-y divide-border/30">
                  {filtered.map((b) => {
                    const m = matchInfo.get(b.id);
                    return (
                      <label key={b.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer">
                        <Checkbox
                          checked={selected.has(b.id)}
                          onCheckedChange={(v) =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (v) next.add(b.id);
                              else next.delete(b.id);
                              return next;
                            })
                          }
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] font-medium truncate leading-tight">{buyerName(b)}</span>
                          {b.company && <span className="block text-[11px] text-muted-foreground truncate leading-tight">{b.company}</span>}
                        </span>
                        <span className="w-48 text-[11px] text-muted-foreground truncate">
                          {[...(b.county_metro ?? []), ...(b.markets ?? [])].slice(0, 2).join(", ") ||
                            (b.states ?? []).slice(0, 2).join(", ") || "—"}
                        </span>
                        <span className="w-20 text-right">
                          {m ? (
                            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-brand-azure/10 text-brand-azure tabular-nums" title={(m.reasons ?? []).join(" · ")}>
                              {m.score}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/50">—</span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                  {filtered.length === 0 && (
                    <div className="px-3 py-8 text-center text-xs text-muted-foreground">No buyers match these filters.</div>
                  )}
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">{selected.size}</span> selected
              {" · "}{filtered.length} shown{matchedOnly ? " (matches)" : ""} · {buyers.length} total buyers
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Channel + template */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid grid-cols-2 gap-2">
                {(["email", "sms"] as const).map((ch) => {
                  const Icon = ch === "email" ? Mail : MessageSquare;
                  const active = channel === ch;
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setChannel(ch)}
                      className={cn(
                        "flex items-center justify-center gap-2 h-9 rounded-md border text-sm font-medium transition-colors",
                        active
                          ? "border-brand-azure bg-brand-azure/10 text-brand-azure"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {ch === "email" ? "Email" : "SMS"}
                    </button>
                  );
                })}
              </div>
              <Select value={templateId || "none"} onValueChange={(v) => (v === "none" ? setTemplateId("") : applyTemplate(v))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Start from template…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Blank — write fresh</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.channel})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {channel === "email" && (
              <div className="space-y-1">
                <Label className="crm-field-label">Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="New deal in {{county}} — {{price}}" />
              </div>
            )}

            <div className="space-y-1">
              <Label className="crm-field-label">Message</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                placeholder={"Hi {{first_name}}, just locked up a deal in {{city}}, {{state}} that fits what you're looking for — {{price}}. Want the details?"}
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {MERGE_CHIPS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setBody((b) => (b ? `${b} ${c}` : c))}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:bg-brand-azure/10 hover:text-brand-azure transition-colors"
                  >
                    {c}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {"{{first_name}}"} fills per buyer at send time; the deal fields fill from this deal.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer shrink-0">
                <Switch checked={saveAsTemplate} onCheckedChange={setSaveAsTemplate} />
                Save as template
              </label>
              {saveAsTemplate && (
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name (e.g. New deal — personal)"
                  className="h-8 text-xs"
                />
              )}
            </div>

            <div className="rounded-md bg-muted/40 border border-border/50 px-3 py-2 text-xs text-muted-foreground">
              Sending to <span className="font-medium text-foreground tabular-nums">{selected.size}</span>{" "}
              buyer{selected.size === 1 ? "" : "s"}. Opted-out buyers are skipped automatically.
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "audience" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={() => setStep("message")} disabled={selected.size === 0} className="gap-1.5">
                Write message <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("audience")} disabled={sending} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> Audience
              </Button>
              <Button onClick={launch} disabled={sending} className="gap-1.5">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? "Sending…" : `Send to ${selected.size}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CampaignComposer;
