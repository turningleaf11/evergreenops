import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Paperclip, Send, X, AtSign, Loader2, FileText, FileSpreadsheet, FileVideo, FileAudio, File as FileIcon } from "lucide-react";
import { uploadFile } from "@/lib/file-upload";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { inferKind } from "@/components/file-viewer/FileViewerProvider";

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
            <AttachmentPreviewChip
              key={a.url}
              attachment={a}
              onRemove={() => setAttachments((prev) => prev.filter((x) => x.url !== a.url))}
            />
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

// Icon + tint per file type — images never land here, they get an actual
// thumbnail instead (see AttachmentChips below).
function fileVisual(name: string, mime?: string): { icon: typeof FileText; tint: string } {
  const kind = inferKind(name, mime);
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (kind === "pdf") return { icon: FileText, tint: "bg-red-500/10 text-red-600 dark:text-red-400" };
  if (kind === "video") return { icon: FileVideo, tint: "bg-violet-500/10 text-violet-600 dark:text-violet-400" };
  if (kind === "audio") return { icon: FileAudio, tint: "bg-pink-500/10 text-pink-600 dark:text-pink-400" };
  if (["xls", "xlsx", "csv"].includes(ext)) return { icon: FileSpreadsheet, tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
  if (["doc", "docx", "txt", "md"].includes(ext)) return { icon: FileText, tint: "bg-blue-500/10 text-blue-600 dark:text-blue-400" };
  return { icon: FileIcon, tint: "bg-muted text-muted-foreground" };
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Small removable chip shown while composing — image thumbnail or type icon. */
export function AttachmentPreviewChip({ attachment, onRemove }: { attachment: CommentAttachment; onRemove: () => void }) {
  const isImage = inferKind(attachment.name, attachment.contentType) === "image";
  const { icon: Icon, tint } = fileVisual(attachment.name, attachment.contentType);
  return (
    <div className="inline-flex items-center gap-1.5 bg-muted rounded-md px-2 py-1 text-xs">
      {isImage ? (
        <img src={attachment.url} alt="" className="h-4 w-4 rounded-sm object-cover shrink-0" />
      ) : (
        <span className={cn("flex items-center justify-center h-4 w-4 rounded-sm shrink-0", tint)}>
          <Icon className="h-3 w-3" />
        </span>
      )}
      <span className="truncate max-w-[160px]">{attachment.name}</span>
      <button onClick={onRemove} className="text-muted-foreground hover:text-destructive">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

/** Posted-comment attachments — images render as real inline thumbnails,
    everything else gets a compact "document card" (type icon + name + size),
    both wrapped as file-attachment anchors so the global FileViewerProvider
    click interceptor still opens the full viewer. */
export function AttachmentChips({ attachments }: { attachments: CommentAttachment[] }) {
  if (!attachments?.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-1.5">
      {attachments.map((a) => {
        if (inferKind(a.name, a.contentType) === "image") {
          return (
            <a
              key={a.url}
              href={a.url}
              data-file-attachment
              data-file-name={a.name}
              className="file-attachment block h-24 w-24 rounded-lg overflow-hidden border border-border/60 hover:border-primary/40 transition-colors"
            >
              <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
            </a>
          );
        }
        const { icon: Icon, tint } = fileVisual(a.name, a.contentType);
        return (
          <a
            key={a.url}
            href={a.url}
            data-file-attachment
            data-file-name={a.name}
            className="file-attachment flex items-center gap-2 rounded-lg border border-border/60 hover:border-primary/40 transition-colors px-2.5 py-2 min-w-[160px] max-w-[220px]"
          >
            <span className={cn("flex items-center justify-center h-8 w-8 rounded-md shrink-0", tint)}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-foreground truncate">{a.name}</span>
              {a.size ? <span className="block text-[10px] text-muted-foreground">{formatFileSize(a.size)}</span> : null}
            </span>
          </a>
        );
      })}
    </div>
  );
}
