import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SendResult {
  threadId?: string;
  id?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSent?: (result: SendResult) => void;
  defaultTo?: string;
  defaultSubject?: string;
  threadId?: string;
  inReplyTo?: string;
}

export function ComposeModal({ open, onOpenChange, onSent, defaultTo = "", defaultSubject = "", threadId, inReplyTo }: Props) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  // Sync defaults when modal reopens with new context (e.g. reply with new defaultTo)
  useEffect(() => {
    if (open) {
      setTo(defaultTo);
      setSubject(defaultSubject);
      setBody("");
    }
  }, [open, defaultTo, defaultSubject]);

  const send = async () => {
    if (!to || !subject) { toast.error("To and subject required"); return; }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("gmail-send", {
      body: {
        to, subject,
        body: body.replace(/\n/g, "<br/>"),
        threadId, inReplyTo,
      },
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Sent");
      setTo(""); setSubject(""); setBody("");
      onOpenChange(false);
      onSent?.({ threadId: (data as any)?.threadId, id: (data as any)?.id });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="To" value={to} onChange={(e) => setTo(e.target.value)} />
          <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <Textarea
            placeholder="Write your message…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={send} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
