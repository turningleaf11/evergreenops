// DealCopyGenerator — one click drafts the deal's listing description + a
// buyer-blast email from everything on the deal record (facts, financing custom
// fields, highlight, price/location). Bilingual optional; Spanish defaults ON in
// Florida. The AI (deal-copy-generate edge fn) reads the deal server-side.
//
// The latest generation is PERSISTED to dispo_deal_details.marketing_copy, so
// switching tabs or reopening the deal keeps the draft. Regenerating overwrites
// it. The email can be pushed straight into a campaign (onUseInCampaign).

import { useEffect, useState } from "react";
import { Sparkles, Loader2, Copy, Check, ArrowDownToLine, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const dispo = supabase as unknown as { from: (table: string) => any };

interface Copy {
  description_en?: string;
  description_es?: string;
  email_subject_en?: string;
  email_body_en?: string;
  email_subject_es?: string;
  email_body_es?: string;
  generated_at?: string;
}

export function DealCopyGenerator({
  transactionId,
  propertyState,
  onUseAsDetails,
  onUseInCampaign,
}: {
  transactionId: string;
  propertyState: string | null;
  onUseAsDetails: (text: string) => void;
  onUseInCampaign?: (subject: string, body: string) => void;
}) {
  const [spanish, setSpanish] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copy, setCopy] = useState<Copy | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  // Load the last saved draft so it survives tab switches / reopening.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await dispo
        .from("dispo_deal_details")
        .select("marketing_copy")
        .eq("transaction_id", transactionId)
        .maybeSingle();
      if (!active) return;
      const saved = (data?.marketing_copy as Copy | null) ?? null;
      if (saved && Object.keys(saved).length) {
        setCopy(saved);
        setGeneratedAt(saved.generated_at ?? null);
        setSpanish(!!(saved.description_es || saved.email_body_es));
      }
    })();
    return () => { active = false; };
  }, [transactionId]);

  // Spanish defaults on for Florida deals (until a saved draft dictates otherwise).
  useEffect(() => {
    if (copy) return;
    const s = (propertyState || "").trim().toLowerCase();
    setSpanish(s === "florida" || s === "fl");
  }, [propertyState, copy]);

  async function generate() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("deal-copy-generate", {
      body: { transactionId, spanish, kinds: ["description", "email"] },
    });
    if (error || (data as any)?.error) {
      setLoading(false);
      toast.error((data as any)?.error || error?.message || "Couldn't generate copy");
      return;
    }
    const c: Copy = { ...(data as { copy: Copy }).copy, generated_at: new Date().toISOString() };
    setCopy(c);
    setGeneratedAt(c.generated_at ?? null);
    // Persist the latest draft (overwrites any prior generation).
    const { error: saveErr } = await dispo
      .from("dispo_deal_details")
      .upsert({ transaction_id: transactionId, marketing_copy: c, updated_at: new Date().toISOString() }, { onConflict: "transaction_id" });
    setLoading(false);
    if (saveErr) toast.error(`Generated, but couldn't save: ${saveErr.message}`);
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h3 className="crm-eyebrow">AI marketing copy</h3>
        {generatedAt && (
          <span className="text-[11px] text-muted-foreground">
            saved · {new Date(generatedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </span>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <Label className="text-xs text-muted-foreground">Include Spanish</Label>
          <Switch checked={spanish} onCheckedChange={setSpanish} />
        </div>
        <Button size="sm" onClick={generate} disabled={loading} className="bg-brand-azure hover:bg-brand-azure/90 text-white">
          {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
          {copy ? "Regenerate" : "Generate copy"}
        </Button>
      </div>

      {!copy && (
        <p className="text-[11px] text-muted-foreground">
          Drafts from the deal's facts, financing, and highlight. Review before sending — the latest draft is saved automatically.
        </p>
      )}

      {copy && (
        <div className="space-y-4">
          <CopyBlock label="Listing description" text={copy.description_en} onUse={onUseAsDetails} />
          {spanish && (
            <CopyBlock label="Listing description (Spanish)" text={copy.description_es} onUse={onUseAsDetails} />
          )}
          <EmailBlock
            label="Buyer email"
            subject={copy.email_subject_en}
            body={copy.email_body_en}
            onUseInCampaign={onUseInCampaign}
          />
          {spanish && (
            <EmailBlock
              label="Buyer email (Spanish)"
              subject={copy.email_subject_es}
              body={copy.email_body_es}
              onUseInCampaign={onUseInCampaign}
            />
          )}
        </div>
      )}
    </section>
  );
}

function useClipboard() {
  const [done, setDone] = useState(false);
  const write = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };
  return { done, write };
}

function CopyBlock({ label, text, onUse }: { label: string; text?: string; onUse: (t: string) => void }) {
  const { done, write } = useClipboard();
  if (!text) return null;
  return (
    <div className="crm-card space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="crm-field-label">{label}</span>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onUse(text)}
            className="inline-flex items-center gap-1 text-[11px] text-brand-azure hover:underline"
          >
            <ArrowDownToLine className="h-3 w-3" /> Use as details
          </button>
          <CopyButton done={done} onClick={() => write(text)} />
        </div>
      </div>
      <p className="text-sm whitespace-pre-wrap leading-relaxed">{text}</p>
    </div>
  );
}

function EmailBlock({
  label,
  subject,
  body,
  onUseInCampaign,
}: {
  label: string;
  subject?: string;
  body?: string;
  onUseInCampaign?: (subject: string, body: string) => void;
}) {
  const { done, write } = useClipboard();
  if (!subject && !body) return null;
  const full = `Subject: ${subject ?? ""}\n\n${body ?? ""}`;
  return (
    <div className="crm-card space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="crm-field-label">{label}</span>
        <div className="flex items-center gap-2.5">
          {onUseInCampaign && (
            <button
              type="button"
              onClick={() => onUseInCampaign(subject ?? "", body ?? "")}
              className="inline-flex items-center gap-1 text-[11px] text-brand-azure hover:underline"
            >
              <Megaphone className="h-3 w-3" /> Use in campaign
            </button>
          )}
          <CopyButton done={done} onClick={() => write(full)} label="Copy email" />
        </div>
      </div>
      {subject && <div className="text-sm font-semibold">{subject}</div>}
      {body && <p className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">{body}</p>}
    </div>
  );
}

function CopyButton({ done, onClick, label = "Copy" }: { done: boolean; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("inline-flex items-center gap-1 text-[11px]", done ? "text-brand-mint-deep" : "text-muted-foreground hover:text-foreground")}
    >
      {done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {done ? "Copied" : label}
    </button>
  );
}

export default DealCopyGenerator;
