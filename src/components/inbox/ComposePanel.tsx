import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, X, Minus, Maximize2, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import RichTextEditor from "@/components/RichTextEditor";
import { uploadFile } from "@/lib/file-upload";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSent?: () => void;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  threadId?: string;
  inReplyTo?: string;
}

export function ComposePanel({ open, onOpenChange, onSent, defaultTo = "", defaultSubject = "", defaultBody = "", threadId, inReplyTo }: Props) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTo(defaultTo);
      setSubject(defaultSubject);
      setBody(defaultBody);
    }
  }, [open, defaultTo, defaultSubject, defaultBody]);

  if (!open) return null;

  const send = async () => {
    if (!to.trim() || !subject.trim()) {
      toast.error("Recipient and subject are required");
      return;
    }
    setSending(true);
    let html = body || "";
    if (attachments.length > 0) {
      html += `<br/><br/><div style="border-top:1px solid #ddd;padding-top:8px;font-size:12px;color:#555;">Attachments:<br/>` +
        attachments.map(a => `<a href="${a.url}">${a.name}</a>`).join("<br/>") + `</div>`;
    }
    const { error } = await supabase.functions.invoke("gmail-send", {
      body: { to, subject, body: html, threadId, inReplyTo },
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Message sent");
      setTo(""); setSubject(""); setBody(""); setAttachments([]);
      onOpenChange(false);
      onSent?.();
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file);
    if (url) {
      setAttachments(a => [...a, { name: file.name, url }]);
      toast.success("Attached");
    } else {
      toast.error("Upload failed");
    }
    e.target.value = "";
  };

  return (
    <div
      className={cn(
        "fixed z-50 bg-card border border-border/50 shadow-2xl rounded-t-lg flex flex-col overflow-hidden",
        maximized
          ? "inset-8"
          : minimized
          ? "bottom-0 right-6 w-[320px] h-10"
          : "bottom-0 right-6 w-[560px] h-[560px] max-h-[80vh]",
      )}
    >
      {/* Header bar */}
      <div className="flex items-center gap-1 px-3 h-10 bg-muted/60 border-b border-border/40 shrink-0">
        <span className="text-xs font-medium flex-1 truncate">
          {subject || (inReplyTo ? "Reply" : "New message")}
        </span>
        <button
          onClick={() => { setMinimized(m => !m); setMaximized(false); }}
          className="h-6 w-6 flex items-center justify-center rounded hover:bg-background/60 text-muted-foreground"
          title={minimized ? "Restore" : "Minimize"}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => { setMaximized(m => !m); setMinimized(false); }}
          className="h-6 w-6 flex items-center justify-center rounded hover:bg-background/60 text-muted-foreground"
          title={maximized ? "Restore" : "Maximize"}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onOpenChange(false)}
          className="h-6 w-6 flex items-center justify-center rounded hover:bg-background/60 text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!minimized && (
        <>
          {/* Recipients */}
          <div className="px-3 py-1.5 border-b border-border/40 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground w-12 shrink-0">To</span>
              <input
                value={to}
                onChange={e => setTo(e.target.value)}
                placeholder="recipient@example.com"
                className="flex-1 bg-transparent text-sm border-0 outline-none py-1.5"
              />
            </div>
          </div>
          <div className="px-3 py-1.5 border-b border-border/40 shrink-0">
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full bg-transparent text-sm font-medium border-0 outline-none py-1.5"
            />
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto">
            <RichTextEditor
              content={body}
              onChange={setBody}
              borderless
              placeholder="Write your message…"
            />
          </div>

          {/* Attachments preview */}
          {attachments.length > 0 && (
            <div className="px-3 py-2 border-t border-border/40 flex flex-wrap gap-1.5 shrink-0">
              {attachments.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px] bg-muted px-2 py-1 rounded">
                  <Paperclip className="h-3 w-3" />
                  <span className="max-w-[160px] truncate">{a.name}</span>
                  <button onClick={() => setAttachments(att => att.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-2 px-3 py-2 border-t border-border/40 shrink-0">
            <Button onClick={send} disabled={sending} size="sm" className="gap-1.5">
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send
            </Button>
            <button
              onClick={() => fileInput.current?.click()}
              className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
              title="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <input ref={fileInput} type="file" className="hidden" onChange={handleFile} />
          </div>
        </>
      )}
    </div>
  );
}
