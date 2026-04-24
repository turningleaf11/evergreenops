import { useState } from "react";
import { Loader2, NotebookPen, Mail, MessageSquare, Phone } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ComposerSubmit =
  | { type: "note"; body: string }
  | { type: "text"; body: string }
  | { type: "call"; outcome: string; durationMin: number; body: string };

export function CrmComposerTabs({
  onSubmit,
  onSendEmail,
  emailDisabled,
}: {
  onSubmit: (payload: ComposerSubmit) => Promise<void> | void;
  onSendEmail?: () => void;
  emailDisabled?: boolean;
}) {
  const [tab, setTab] = useState<"note" | "email" | "text" | "call">("note");
  const [noteBody, setNoteBody] = useState("");
  const [textBody, setTextBody] = useState("");
  const [callOutcome, setCallOutcome] = useState("connected");
  const [callDuration, setCallDuration] = useState("5");
  const [callBody, setCallBody] = useState("");
  const [saving, setSaving] = useState(false);

  const handle = async (payload: ComposerSubmit) => {
    setSaving(true);
    try {
      await onSubmit(payload);
      if (payload.type === "note") setNoteBody("");
      if (payload.type === "text") setTextBody("");
      if (payload.type === "call") {
        setCallBody("");
        setCallDuration("5");
        setCallOutcome("connected");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="h-9 bg-transparent border-b border-border/40 rounded-none w-full justify-start px-2 gap-1">
          <TabsTrigger value="note" className="gap-1.5 data-[state=active]:bg-muted">
            <NotebookPen className="h-3.5 w-3.5" /> Create note
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-1.5 data-[state=active]:bg-muted">
            <Mail className="h-3.5 w-3.5" /> Send email
          </TabsTrigger>
          <TabsTrigger value="text" className="gap-1.5 data-[state=active]:bg-muted">
            <MessageSquare className="h-3.5 w-3.5" /> Text
          </TabsTrigger>
          <TabsTrigger value="call" className="gap-1.5 data-[state=active]:bg-muted">
            <Phone className="h-3.5 w-3.5" /> Log call
          </TabsTrigger>
        </TabsList>

        <TabsContent value="note" className="m-0 p-3 space-y-2">
          <Textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Write a note… use @ to mention someone"
            rows={3}
            className="text-sm resize-none"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => handle({ type: "note", body: noteBody.trim() })}
              disabled={saving || !noteBody.trim()}
            >
              {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Save note
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="email" className="m-0 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Open the composer to write a new email. Replies will thread automatically.
            </p>
            <Button size="sm" onClick={onSendEmail} disabled={emailDisabled}>
              <Mail className="h-3.5 w-3.5 mr-1.5" /> Compose
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="text" className="m-0 p-3 space-y-2">
          <Textarea
            value={textBody}
            onChange={(e) => setTextBody(e.target.value)}
            placeholder="Log an SMS message…"
            rows={3}
            className="text-sm resize-none"
          />
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              Logs an SMS activity. Twilio sending coming soon.
            </p>
            <Button
              size="sm"
              onClick={() => handle({ type: "text", body: textBody.trim() })}
              disabled={saving || !textBody.trim()}
            >
              {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Log text
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="call" className="m-0 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">Outcome</div>
              <Select value={callOutcome} onValueChange={setCallOutcome}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="connected">Connected</SelectItem>
                  <SelectItem value="voicemail">Left voicemail</SelectItem>
                  <SelectItem value="no_answer">No answer</SelectItem>
                  <SelectItem value="busy">Busy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">Duration (min)</div>
              <Input
                type="number"
                min={0}
                value={callDuration}
                onChange={(e) => setCallDuration(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <Textarea
            value={callBody}
            onChange={(e) => setCallBody(e.target.value)}
            placeholder="Call notes…"
            rows={2}
            className="text-sm resize-none"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() =>
                handle({
                  type: "call",
                  outcome: callOutcome,
                  durationMin: Number(callDuration) || 0,
                  body: callBody.trim(),
                })
              }
              disabled={saving}
            >
              {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Log call
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
