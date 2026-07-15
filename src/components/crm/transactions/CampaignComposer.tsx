// CampaignComposer — compose + send a blast to the buyers on a deal.
//
// OpsHQ decides (audience = the buyers on this deal, copy, channel); GHL
// delivers. Creates a dispo_campaigns row + dispo_campaign_recipients, then
// loops the send-campaign function until every recipient is processed.
// Opted-out buyers are skipped server-side.

import { useState } from "react";
import { Send, Loader2, Mail, MessageSquare } from "lucide-react";
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
import { cn } from "@/lib/utils";

const dispo = supabase as unknown as { from: (table: string) => any };

export function CampaignComposer({
  transactionId,
  buyerIds,
  open,
  onOpenChange,
  onSent,
}: {
  transactionId: string;
  buyerIds: string[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSent?: () => void;
}) {
  const { user } = useAuth();
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const count = buyerIds.length;

  async function launch() {
    if (!body.trim()) return toast.error("Add a message first");
    if (channel === "email" && !subject.trim()) return toast.error("Add a subject line");
    if (count === 0) return toast.error("No buyers to send to");
    const ok = window.confirm(
      `Send this ${channel === "email" ? "email" : "SMS"} to ${count} buyer${count === 1 ? "" : "s"} on this deal?\n\nBuyers who opted out of ${channel} are skipped automatically. This sends real messages via GHL.`,
    );
    if (!ok) return;

    setSending(true);
    try {
      const { data: campaign, error: cErr } = await dispo
        .from("dispo_campaigns")
        .insert({
          transaction_id: transactionId,
          channel,
          subject: channel === "email" ? subject.trim() : null,
          body: body.trim(),
          status: "draft",
          audience: "interested",
          recipient_count: count,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (cErr || !campaign) throw new Error(cErr?.message || "Couldn't create campaign");

      const { error: rErr } = await dispo.from("dispo_campaign_recipients").insert(
        buyerIds.map((bid) => ({ campaign_id: campaign.id, buyer_id: bid, status: "pending" })),
      );
      if (rErr) throw new Error(rErr.message);

      // Loop the batch sender until nothing is pending.
      let remaining = count;
      let totalSent = 0;
      let totalOther = 0;
      let guard = 0;
      while (remaining > 0 && guard < 200) {
        guard++;
        const { data, error } = await supabase.functions.invoke("send-campaign", {
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
        `Sent ${totalSent} ${channel === "email" ? "email" : "SMS"}${totalSent === 1 ? "" : "s"}` +
          (totalOther ? ` · ${totalOther} skipped/failed` : ""),
      );
      setSubject("");
      setBody("");
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Message buyers on this deal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Channel */}
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

          {channel === "email" && (
            <div className="space-y-1">
              <Label className="crm-field-label">Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="New deal in your buy-box"
              />
            </div>
          )}

          <div className="space-y-1">
            <Label className="crm-field-label">Message</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={7}
              placeholder={"Hi {{first_name}}, just picked up a new one that fits what you're looking for…"}
            />
            <p className="text-[11px] text-muted-foreground">
              Use <code className="text-[10px]">{"{{first_name}}"}</code> to personalize per buyer.
            </p>
          </div>

          <div className="rounded-md bg-muted/40 border border-border/50 px-3 py-2 text-xs text-muted-foreground">
            Sending to <span className="font-medium text-foreground tabular-nums">{count}</span>{" "}
            buyer{count === 1 ? "" : "s"} on this deal. Opted-out buyers are skipped automatically.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={launch} disabled={sending} className="gap-1.5">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? "Sending…" : `Send to ${count}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CampaignComposer;
