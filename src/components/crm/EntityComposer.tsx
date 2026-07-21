import { useState } from "react";
import { Loader2, Mail, NotebookPen, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { InlineEmailComposer } from "./InlineEmailComposer";
import {
  ActivityComposer,
  type ActivitySubmitPayload,
} from "@/components/activity/ActivityComposer";

/**
 * Generic Note / Email / Log Call composer for any CRM entity (lead, deal,
 * transaction, contact). Mirrors the styling/behavior of ContactComposer so
 * Lead/Deal/Transaction sheets feel like siblings of Contact.
 *
 * Records are written to `crm_activities` keyed by `entityType` + `entityId`.
 */
export function EntityComposer({
  workspaceId,
  entityType,
  entityId,
  defaultEmail,
  notePlaceholder,
  onPosted,
}: {
  workspaceId: string | null;
  entityType: "lead" | "deal" | "transaction" | "contact";
  entityId: string;
  /** Optional pre-filled "to" address for the Email tab. */
  defaultEmail?: string | null;
  notePlaceholder?: string;
  onPosted?: () => void;
}) {
  const { user } = useAuth();
  const [tab, setTab] = useState<"note" | "email" | "call">("note");

  const [savingNote, setSavingNote] = useState(false);
  const [callOutcome, setCallOutcome] = useState("answered");
  const [callDuration, setCallDuration] = useState("");
  const [callBody, setCallBody] = useState("");
  const [savingCall, setSavingCall] = useState(false);

  const submitNote = async (payload: ActivitySubmitPayload) => {
    if (!user) return;
    const { contentHtml, contentText, attachments, gifUrl, audioUrl } = payload;
    if (!contentText.trim() && attachments.length === 0 && !gifUrl && !audioUrl) return;
    setSavingNote(true);

    const extras: string[] = [];
    attachments.forEach((a) =>
      extras.push(
        `<p>📎 <a href="${a.url}" target="_blank" rel="noreferrer">${a.name}</a></p>`,
      ),
    );
    if (gifUrl) extras.push(`<p><img src="${gifUrl}" alt="gif" /></p>`);
    if (audioUrl)
      extras.push(
        `<p>🎙️ <a href="${audioUrl}" target="_blank" rel="noreferrer">Voice note</a></p>`,
      );
    const body = `${contentHtml}${extras.join("")}`;

    const { error } = await supabase.from("crm_activities").insert({
      workspace_id: workspaceId,
      entity_type: entityType,
      entity_id: entityId,
      type: "note",
      subject: "",
      body,
      actor_id: user.id,
      metadata: {
        rich: true,
        attachments,
        gif_url: gifUrl,
        audio_url: audioUrl,
      } as any,
    });
    setSavingNote(false);
    if (error) {
      toast({
        title: "Couldn't save note",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    onPosted?.();
  };

  const submitCall = async () => {
    if (!user) return;
    setSavingCall(true);
    const outcomeLabel = callOutcome.replace(/_/g, " ");
    const subject = `Call · ${outcomeLabel}${callDuration ? ` · ${callDuration}` : ""}`;
    const { error } = await supabase.from("crm_activities").insert({
      workspace_id: workspaceId,
      entity_type: entityType,
      entity_id: entityId,
      type: "call",
      subject,
      body: callBody.trim(),
      actor_id: user.id,
    });
    setSavingCall(false);
    if (error) {
      toast({
        title: "Couldn't log call",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setCallBody("");
    setCallDuration("");
    setCallOutcome("answered");
    onPosted?.();
  };

  return (
    <div className="rounded-xl border border-border/60 bg-background overflow-hidden">
      <div className="flex items-center gap-1 px-2 pt-2 border-b border-border/40">
        {(
          [
            { id: "note", label: "Note", Icon: NotebookPen },
            { id: "email", label: "Email", Icon: Mail },
            { id: "call", label: "Log Call", Icon: Phone },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-md border-b-2 -mb-px transition-colors",
              tab === id
                ? "border-[#3E54D3] text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "note" && (
        <div className="p-3 contact-note-composer">
          <ActivityComposer
            placeholder={notePlaceholder ?? "Jot a sticky note…"}
            onSubmit={submitNote}
            submitting={savingNote}
          />
        </div>
      )}

      {tab === "email" && (
        <div className="p-3">
          <InlineEmailComposer
            defaultTo={defaultEmail || ""}
            defaultSubject=""
            onClose={() => setTab("note")}
            onSent={async (r) => {
              // Log the sent email onto this entity's timeline so it's tracked.
              if (user) {
                await supabase.from("crm_activities").insert({
                  workspace_id: workspaceId,
                  entity_type: entityType,
                  entity_id: entityId,
                  type: "email",
                  subject: r.subject ? `Sent: ${r.subject}` : "Sent email",
                  body: r.body ?? "",
                  actor_id: user.id,
                  metadata: { direction: "outbound", to: r.to, gmail_thread_id: r.threadId, gmail_message_id: r.id } as any,
                });
              }
              setTab("note");
              onPosted?.();
            }}
          />
        </div>
      )}

      {tab === "call" && (
        <div className="p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">Outcome</div>
              <Select value={callOutcome} onValueChange={setCallOutcome}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="answered">Answered</SelectItem>
                  <SelectItem value="no_answer">No Answer</SelectItem>
                  <SelectItem value="left_voicemail">Left Voicemail</SelectItem>
                  <SelectItem value="wrong_number">Wrong Number</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">
                Duration (optional)
              </div>
              <Input
                value={callDuration}
                onChange={(e) => setCallDuration(e.target.value)}
                placeholder="e.g. 5m"
                className="h-9 text-sm"
              />
            </div>
          </div>
          <Textarea
            value={callBody}
            onChange={(e) => setCallBody(e.target.value)}
            placeholder="Call notes…"
            rows={3}
            className="text-sm resize-none border-border/50"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={submitCall}
              disabled={savingCall}
              style={{ backgroundColor: "#3E54D3" }}
              className="text-white hover:opacity-90"
            >
              {savingCall && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
              Log Call
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
