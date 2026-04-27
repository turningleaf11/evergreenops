import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Clock,
  FileText,
  Loader2,
  Paperclip,
  Save,
  Send,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";
import RichTextEditor from "@/components/RichTextEditor";
import { uploadFile } from "@/lib/file-upload";
import { handleGmailInvokeError } from "@/lib/gmail-error";
import { useGmailAccess } from "@/hooks/useGmailAccess";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  category: string | null;
}

const SCHEDULE_PRESETS: { label: string; build: () => Date }[] = [
  { label: "In 1 hour", build: () => new Date(Date.now() + 60 * 60 * 1000) },
  { label: "In 3 hours", build: () => new Date(Date.now() + 3 * 60 * 60 * 1000) },
  {
    label: "Tomorrow 9am",
    build: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
  {
    label: "Monday 9am",
    build: () => {
      const d = new Date();
      const day = d.getDay();
      const add = (8 - day) % 7 || 7;
      d.setDate(d.getDate() + add);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
];

function applyMergeFields(text: string, recipient: string): string {
  const local = recipient.split("@")[0] || "";
  const first = local.split(/[._-]/)[0] || "there";
  const firstName = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  return text
    .replace(/\{\{\s*first_name\s*\}\}/gi, firstName)
    .replace(/\{\{\s*email\s*\}\}/gi, recipient);
}

/**
 * Inline email composer rendered inside a CRM detail sheet (no modal/popup).
 * Mirrors the ComposeModal styling/features (templates, AI draft, schedule send,
 * attachments) but laid out for the sheet's tab content area.
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
  const { user } = useAuth();
  const { id: workspaceId } = useWorkspace();
  const { accounts, defaultAccount } = useGmailAccess();

  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);
  const [saveTplOpen, setSaveTplOpen] = useState(false);
  const [tplName, setTplName] = useState("");
  const [customWhen, setCustomWhen] = useState("");
  const [accountId, setAccountId] = useState<string | null>(defaultAccount?.id ?? null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAccountId(defaultAccount?.id ?? null);
  }, [defaultAccount?.id]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("email_templates")
        .select("id,name,subject,body_html,category")
        .order("name", { ascending: true })
        .limit(100);
      setTemplates((data as EmailTemplate[]) || []);
    })();
  }, []);

  // Load this user's email signature (PNG URL) so we can append it to outgoing mail.
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("email_signature_url")
        .eq("user_id", user.id)
        .maybeSingle();
      setSignatureUrl((data as any)?.email_signature_url ?? null);
    })();
  }, [user?.id]);

  const activeAccount = accounts.find((a) => a.id === accountId) ?? defaultAccount;

  const buildSignatureHtml = (): string => {
    if (!signatureUrl) return "";
    return `<br/><br/><div class="email-signature"><img src="${signatureUrl}" alt="Signature" style="max-width:480px;height:auto;display:block;" /></div>`;
  };

  const buildHtml = (): string => {
    let html = body || "";
    if (attachments.length > 0) {
      html +=
        `<br/><br/><div style="border-top:1px solid #ddd;padding-top:8px;font-size:12px;color:#555;">Attachments:<br/>` +
        attachments.map((a) => `<a href="${a.url}">${a.name}</a>`).join("<br/>") +
        `</div>`;
    }
    html += buildSignatureHtml();
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

  const schedule = async (when: Date) => {
    if (!to.trim() || !subject.trim()) {
      toast.error("To and subject required");
      return;
    }
    if (!user || !workspaceId) {
      toast.error("Not signed in");
      return;
    }
    if (when.getTime() <= Date.now() + 30 * 1000) {
      toast.error("Pick a time at least a minute from now");
      return;
    }
    setScheduling(true);
    const { error } = await supabase.from("scheduled_emails").insert({
      workspace_id: workspaceId,
      user_id: user.id,
      to_email: to,
      subject,
      body_html: buildHtml(),
      thread_id: threadId ?? null,
      in_reply_to: inReplyTo ?? null,
      send_at: when.toISOString(),
      account_id: accountId ?? null,
    } as any);
    setScheduling(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Scheduled for ${when.toLocaleString()}`);
    onClose();
  };

  const applyTemplate = (tpl: EmailTemplate) => {
    if (tpl.subject) setSubject(applyMergeFields(tpl.subject, to));
    if (tpl.body_html) setBody(applyMergeFields(tpl.body_html, to));
    toast.success(`Inserted "${tpl.name}"`);
  };

  const draftWithAi = async () => {
    setAiBusy(true);
    const { data, error } = await supabase.functions.invoke("email-draft-ai", {
      body: {
        recipientEmail: to,
        context: subject || (inReplyTo ? "Reply to ongoing thread" : "First outreach"),
        goal: "Get a quick reply or book a short call",
        tone: "friendly, concise",
      },
    });
    setAiBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const out = data as { subject?: string; body_html?: string };
    if (out?.subject && !subject) setSubject(out.subject);
    if (out?.body_html) setBody(out.body_html);
    toast.success("Draft generated");
  };

  const saveAsTemplate = async () => {
    if (!tplName.trim() || !workspaceId) return;
    const { error } = await supabase.from("email_templates").insert({
      workspace_id: workspaceId,
      name: tplName.trim(),
      subject,
      body_html: body,
      created_by: user?.id ?? null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Template saved");
    setSaveTplOpen(false);
    setTplName("");
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file);
    if (url) {
      setAttachments((a) => [...a, { name: file.name, url }]);
      toast.success("Attached");
    } else {
      toast.error("Upload failed");
    }
    e.target.value = "";
  };

  return (
    <div className="flex flex-col">
      {/* Composer header — back arrow + title, matches sheet rhythm */}
      <div className="flex items-center justify-between gap-2 px-5 h-11 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} title="Back">
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-sm font-semibold">
            {inReplyTo ? "Reply" : "New message"}
          </span>
        </div>
      </div>

      {/* From / To / Subject — borderless rows separated by underlines */}
      <div className="px-5 pt-3 space-y-2 pb-2 shrink-0">
        {accounts.length >= 1 && activeAccount && (
          <div className="flex items-center gap-2 border-b border-border/40 pb-2">
            <span className="text-xs text-muted-foreground w-12 shrink-0">From</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 text-sm py-1 hover:text-primary transition-colors">
                  <span className="truncate max-w-[420px]">
                    {activeAccount.label
                      ? `${activeAccount.label} · ${activeAccount.email}`
                      : activeAccount.email}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                {accounts.map((a) => (
                  <DropdownMenuItem key={a.id} onClick={() => setAccountId(a.id)}>
                    <div className="flex flex-col">
                      <span className="text-sm">{a.label || a.email}</span>
                      {a.label && (
                        <span className="text-[11px] text-muted-foreground">{a.email}</span>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        <div className="flex items-center gap-2 border-b border-border/40 pb-2">
          <span className="text-xs text-muted-foreground w-12 shrink-0">To</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com"
            className="flex-1 bg-transparent text-sm border-0 outline-none py-1"
          />
        </div>
        <div className="flex items-center gap-2 border-b border-border/40 pb-2">
          <span className="text-xs text-muted-foreground w-12 shrink-0">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 bg-transparent text-sm font-medium border-0 outline-none py-1"
          />
        </div>
      </div>

      {/* Quick actions row */}
      <div className="px-5 py-2 flex items-center gap-1 flex-wrap border-b border-border/40 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
              <FileText className="h-3.5 w-3.5" /> Choose template
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-xs">Templates</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {templates.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                No templates yet. Save one with the disk icon below.
              </div>
            ) : (
              templates.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onClick={() => applyTemplate(t)}
                  className="flex flex-col items-start gap-0.5"
                >
                  <span className="text-sm">{t.name}</span>
                  {t.subject && (
                    <span className="text-[11px] text-muted-foreground truncate max-w-full">
                      {t.subject}
                    </span>
                  )}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
              Insert field <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setBody((b) => b + " {{first_name}}")}>
              {"{{first_name}}"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setBody((b) => b + " {{email}}")}>
              {"{{email}}"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={draftWithAi}
          disabled={aiBusy}
        >
          {aiBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Draft with AI
        </Button>

        <Popover open={saveTplOpen} onOpenChange={setSaveTplOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" title="Save as template">
              <Save className="h-3.5 w-3.5" /> Save template
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 space-y-2">
            <div className="text-xs font-medium">Save current email as template</div>
            <Input
              placeholder="Template name"
              value={tplName}
              onChange={(e) => setTplName(e.target.value)}
              className="h-8 text-sm"
              autoFocus
            />
            <Button size="sm" className="w-full" onClick={saveAsTemplate}>
              Save
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      {/* Body — capped height so the composer never stretches the whole sheet */}
      <div className="overflow-auto max-h-[260px]">
        <RichTextEditor
          content={body}
          onChange={setBody}
          borderless
          placeholder="Write your message…"
        />
      </div>

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="px-5 py-2 border-t border-border/40 flex flex-wrap gap-1.5 shrink-0">
          {attachments.map((a, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 text-[11px] bg-muted px-2 py-1 rounded"
            >
              <Paperclip className="h-3 w-3" />
              <span className="max-w-[160px] truncate">{a.name}</span>
              <button
                onClick={() => setAttachments((att) => att.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-foreground ml-1"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => fileInput.current?.click()}
            className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
            title="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input ref={fileInput} type="file" className="hidden" onChange={handleFile} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <div className="inline-flex rounded-md overflow-hidden border border-primary">
            <Button
              onClick={send}
              disabled={sending || scheduling}
              className="rounded-none border-0"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="rounded-none border-0 border-l border-primary-foreground/20 px-2"
                  disabled={sending || scheduling}
                  title="Schedule send"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs">
                  <Clock className="h-3 w-3 inline mr-1" /> Schedule send
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {SCHEDULE_PRESETS.map((p) => (
                  <DropdownMenuItem
                    key={p.label}
                    onClick={() => schedule(p.build())}
                  >
                    {p.label}
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {p.build().toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 space-y-1.5">
                  <div className="text-[11px] text-muted-foreground">Custom date & time</div>
                  <Input
                    type="datetime-local"
                    value={customWhen}
                    onChange={(e) => setCustomWhen(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Button
                    size="sm"
                    className="w-full h-7 text-xs"
                    disabled={!customWhen}
                    onClick={() => {
                      if (customWhen) schedule(new Date(customWhen));
                    }}
                  >
                    Schedule
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}
