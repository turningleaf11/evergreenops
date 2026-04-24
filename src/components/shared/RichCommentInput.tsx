import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Paperclip, Send, X, AtSign, Loader2, FileText } from "lucide-react";
import { uploadFile } from "@/lib/file-upload";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface CommentAttachment {
  url: string;
  name: string;
  size?: number;
  contentType?: string;
}

export interface CommentMention {
  user_id: string;
  full_name: string;
}

interface Person {
  user_id: string;
  full_name: string | null;
}

interface Props {
  placeholder?: string;
  onSubmit: (payload: { content: string; attachments: CommentAttachment[]; mentions: string[] }) => Promise<void> | void;
  submitting?: boolean;
  compact?: boolean;
  autoFocus?: boolean;
}

/** Comment/reply input with @mention popover + file attachments. */
export function RichCommentInput({ placeholder = "Write a comment...", onSubmit, submitting, compact, autoFocus }: Props) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<CommentAttachment[]>([]);
  const [mentions, setMentions] = useState<CommentMention[]>([]);
  const [uploading, setUploading] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);

  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("user_id, full_name")
      .then(({ data }) => { if (data) setPeople(data); });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    const caret = e.target.selectionStart;
    // Find last @ token
    const upto = val.slice(0, caret);
    const at = upto.lastIndexOf("@");
    if (at >= 0 && (at === 0 || /\s/.test(upto[at - 1]))) {
      const q = upto.slice(at + 1);
      if (!/\s/.test(q)) {
        setMentionStart(at);
        setMentionQuery(q);
        setMentionOpen(true);
        return;
      }
    }
    setMentionOpen(false);
  };

  const insertMention = (p: Person) => {
    if (mentionStart === null) return;
    const before = text.slice(0, mentionStart);
    const after = text.slice((taRef.current?.selectionStart) ?? text.length);
    const name = p.full_name || "Unnamed";
    const next = `${before}@${name} ${after}`;
    setText(next);
    setMentions((prev) => prev.find((m) => m.user_id === p.user_id) ? prev : [...prev, { user_id: p.user_id, full_name: name }]);
    setMentionOpen(false);
    setMentionStart(null);
    setMentionQuery("");
    setTimeout(() => {
      taRef.current?.focus();
      const pos = before.length + name.length + 2;
      taRef.current?.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file);
      if (!url) throw new Error("Upload failed");
      setAttachments((prev) => [...prev, { url, name: file.name, size: file.size, contentType: file.type }]);
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = useCallback(async () => {
    if (!text.trim() && attachments.length === 0) return;
    await onSubmit({ content: text.trim(), attachments, mentions: mentions.map((m) => m.user_id) });
    setText("");
    setAttachments([]);
    setMentions([]);
  }, [text, attachments, mentions, onSubmit]);

  const filtered = people.filter((p) => (p.full_name || "").toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6);

  return (
    <div className="space-y-2">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <div key={a.url} className="inline-flex items-center gap-1.5 bg-muted rounded-md px-2 py-1 text-xs">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <a href={a.url} target="_blank" rel="noopener" className="text-foreground hover:underline truncate max-w-[160px]">{a.name}</a>
              <button onClick={() => setAttachments((prev) => prev.filter((x) => x.url !== a.url))} className="text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="relative">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <Textarea
              ref={taRef}
              value={text}
              onChange={handleChange}
              placeholder={placeholder}
              autoFocus={autoFocus}
              rows={compact ? 1 : 2}
              className={cn("text-sm resize-none", compact && "min-h-[36px]")}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !mentionOpen) {
                  e.preventDefault();
                  submit();
                }
                if (e.key === "Escape") setMentionOpen(false);
              }}
            />
            {mentionOpen && filtered.length > 0 && (
              <div className="absolute z-50 bottom-full mb-1 left-0 w-56 rounded-md border bg-popover shadow-md p-1 max-h-48 overflow-y-auto">
                {filtered.map((p) => (
                  <button
                    key={p.user_id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); insertMention(p); }}
                    className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted flex items-center gap-2"
                  >
                    <AtSign className="h-3 w-3 text-muted-foreground" />
                    {p.full_name || "Unnamed"}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1 shrink-0 self-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground/70"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title="Attach file"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
            </Button>
            <Button
              size="icon"
              className="h-7 w-7"
              onClick={submit}
              disabled={submitting || (!text.trim() && attachments.length === 0)}
              title="Send"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}

export function AttachmentChips({ attachments }: { attachments: CommentAttachment[] }) {
  if (!attachments?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {attachments.map((a) => (
        <a
          key={a.url}
          href={a.url}
          data-file-attachment
          data-file-name={a.name}
          className="file-attachment inline-flex items-center gap-1.5 bg-muted/60 hover:bg-muted rounded-md px-2 py-0.5 text-xs text-foreground/90 cursor-pointer"
        >
          <FileText className="h-3 w-3 text-muted-foreground" />
          <span className="truncate max-w-[160px]">{a.name}</span>
        </a>
      ))}
    </div>
  );
}
