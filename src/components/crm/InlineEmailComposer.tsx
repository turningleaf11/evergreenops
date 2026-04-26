import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import RichTextEditor from "@/components/RichTextEditor";
import { uploadFile } from "@/lib/file-upload";
import { handleGmailInvokeError } from "@/lib/gmail-error";
import { useGmailAccess } from "@/hooks/useGmailAccess";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Inline email composer rendered inside a CRM detail sheet (no modal/popup).
 * Fills the tab content area while open. Closes back to the previous tab on send/cancel.
 */
export function InlineEmailComposer({
  defaultTo = "",
  defaultSubject = "",
  threadId,
  inReplyTo,
  onClose,
  onSent,
}: {
  defaultTo?: string;
  defaultSubject?: string;
  threadId?: string;
  inReplyTo?: string;
  onClose: () => void;
  onSent?: (result: { threadId?: string; id?: string }) => void;
}) {
  const { accounts, defaultAccount } = useGmailAccess();
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);
  const [accountId, setAccountId] = useState<string | null>(defaultAccount?.id ?? null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAccountId(defaultAccount?.id ?? null);
  }, [defaultAccount?.id]);

  const activeAccount = accounts.find((a) => a.id === accountId) ?? defaultAccount;

  const buildHtml = (): string => {
    let html = body || "";
    if (attachments.length > 0) {
      html +=
        `<br/><br/><div style="border-top:1px solid #ddd;padding-top:8px;font-size:12px;color:#555;">Attachments:<br/>` +
        attachments.map((a) => `<a href="${a.url}">${a.name}</a>`).join("<br/>") +
        `</div>`;
    }
    return html;
  };

  const send = async () => {
    if (!to.trim() || !subject.trim()) {
      toast.error("To and subject required");
      return;
    }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("gmail-send", {
      body: {
        to,
        subject,
        body: buildHtml(),
        threadId,
        inReplyTo,
        account_id: accountId ?? undefined,
      },
    });
    setSending(false);
    if (error) {
      const handled = await handleGmailInvokeError(error);
      if (!handled) toast.error(error.message);
      return;
    }
    toast.success("Sent");
    onSent?.({ threadId: (data as any)?.threadId, id: (data as any)?.id });
    onClose();
  };

  const handleAttach = async (file: File) => {
    try {
      const { url } = await uploadFile(file, "email-attachments");
      setAttachments((a) => [...a, { name: file.name, url }]);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Composer header */}
      <div className="flex items-center justify-between gap-2 px-4 h-11 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} title="Back">
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-sm font-semibold">New email</span>
        </div>
        {accounts.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
                {activeAccount?.email ?? "From…"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {accounts.map((a) => (
                <DropdownMenuItem key={a.id} onClick={() => setAccountId(a.id)}>
                  {a.email}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Fields */}
      <div className="px-4 pt-3 space-y-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-14 shrink-0">To</span>
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com"
            className="h-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-14 shrink-0">Subject</span>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 px-4 py-3 overflow-auto">
        <RichTextEditor value={body} onChange={setBody} placeholder="Write your message…" />
        {attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {attachments.map((a, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs"
              >
                <Paperclip className="h-3 w-3" />
                {a.name}
                <button
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setAttachments((arr) => arr.filter((_, idx) => idx !== i))}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border/50 shrink-0">
        <div className="flex items-center gap-1">
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleAttach(f);
              e.target.value = "";
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => fileInput.current?.click()}
            title="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={send} disabled={sending}>
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5 mr-1.5" />
            )}
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
