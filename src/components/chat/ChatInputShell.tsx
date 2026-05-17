// ChatInputShell — the single chat-input component used across the app.
//
// TipTap-powered rich text (matches the /notes editor), slash commands,
// inline @mentions (people/projects/tasks/goals/docs/etc), attachments,
// GIFs, voice notes, emoji, and a send button. Surfaces that need a chat
// input — Sync, Albus, ScratchPad, comments — all use this so the
// behavior + look are identical everywhere.

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TextStyle from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { useCallback, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Paperclip, Send, Smile, Mic, Square, Loader2, X, FileText, Image as ImageIcon,
} from "lucide-react";
import { SlashCommands } from "@/components/SlashCommandMenu";
import { UniversalMention } from "@/extensions/MentionExtension";
import { uploadFile, triggerFileInput } from "@/lib/file-upload";
import { GiphyPicker } from "@/components/feed/GiphyPicker";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const EMOJIS = ["👍","❤️","🎉","🔥","🙌","👏","😂","😍","🤔","✅","❌","🚀","💡","⚡","✨","💪","👀","💯","🙏","😅","😎","🤝","👋","☕","📌","📎","🗓️","🎯","💬","🔔"];

export type ChatAttachment = {
  url: string;
  name: string;
  size: number;
  type: string;
};

export type ChatMention = {
  id: string;
  type: string;        // "person" | "project" | "task" | "goal" | "doc" | "note" | "record"
  label: string;
  url?: string;
};

export interface ChatSubmitPayload {
  html: string;
  text: string;
  mentions: ChatMention[];
  attachments: ChatAttachment[];
  gifUrl: string | null;
  audioUrl: string | null;
}

interface Props {
  placeholder?: string;
  onSubmit: (p: ChatSubmitPayload) => Promise<void> | void;
  submitting?: boolean;
  autoFocus?: boolean;
  /** Visual height of the editor surface. Default 80px (chat-style); pass higher for note-style. */
  minHeight?: number;
  /** Toggle individual tools — defaults all on. */
  showAttachments?: boolean;
  showImageUpload?: boolean;
  showMentionShortcut?: boolean;
  showEmoji?: boolean;
  showGif?: boolean;
  showVoice?: boolean;
  /** Hide the send button (the caller submits some other way). */
  hideSendButton?: boolean;
  /** Extra className on the outer container. */
  className?: string;
}

export function ChatInputShell({
  placeholder = "Write…",
  onSubmit,
  submitting,
  autoFocus,
  minHeight = 80,
  showAttachments = true,
  showImageUpload = true,
  showMentionShortcut = true,
  showEmoji = true,
  showGif = true,
  showVoice = true,
  hideSendButton = false,
  className,
}: Props) {
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioUploading, setAudioUploading] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({}),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline" } }),
      Image,
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Underline,
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      SlashCommands,
      UniversalMention,
    ] as any,
    content: "",
    autofocus: autoFocus ?? false,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none px-3 py-2.5 text-sm",
        style: `min-height:${minHeight}px`,
      },
      handleKeyDown(_view, event) {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          void submit();
          return true;
        }
        return false;
      },
    },
  });

  const reset = useCallback(() => {
    editor?.commands.clearContent(true);
    setAttachments([]);
    setGifUrl(null);
    setAudioUrl(null);
  }, [editor]);

  const submit = useCallback(async () => {
    if (!editor) return;
    const html = editor.getHTML();
    const text = editor.getText().trim();
    const isEmpty = !text && attachments.length === 0 && !gifUrl && !audioUrl;
    if (isEmpty) return;

    // Walk the rendered HTML to extract mentions (id + type + label + url).
    const mentions: ChatMention[] = [];
    const dom = document.createElement("div");
    dom.innerHTML = html;
    dom.querySelectorAll<HTMLElement>("[data-id][data-mention-type], [data-id][data-type]").forEach((el) => {
      const id = el.getAttribute("data-id") || "";
      const type = el.getAttribute("data-mention-type") || el.getAttribute("data-type") || "person";
      const label = (el.textContent || "").replace(/^@/, "").trim();
      const url = el.getAttribute("data-url") || undefined;
      if (id) mentions.push({ id, type, label, url });
    });

    await onSubmit({ html, text, mentions, attachments, gifUrl, audioUrl });
    reset();
  }, [editor, attachments, gifUrl, audioUrl, onSubmit, reset]);

  const handleAttach = (accept: string) => {
    triggerFileInput(accept, async (file) => {
      setUploading(true);
      try {
        const url = await uploadFile(file);
        if (!url) throw new Error("Upload failed");
        setAttachments((prev) => [...prev, { url, name: file.name, size: file.size, type: file.type }]);
      } catch (e: any) {
        toast.error(e?.message || "Upload failed");
      } finally {
        setUploading(false);
      }
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioUploading(true);
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        const url = await uploadFile(file);
        if (url) setAudioUrl(url);
        else toast.error("Audio upload failed");
        setAudioUploading(false);
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    setRecording(false);
  };

  const insertEmoji = (emoji: string) => {
    editor?.chain().focus().insertContent(emoji).run();
  };

  return (
    <div className={cn("rounded-xl border border-border/60 bg-background shadow-sm", className)}>
      {(attachments.length > 0 || gifUrl || audioUrl) && (
        <div className="px-3 pt-3 pb-1 flex flex-wrap gap-1.5 border-b border-border/40">
          {attachments.map((a) => (
            <div key={a.url} className="inline-flex items-center gap-1.5 bg-muted rounded-md px-2 py-1 text-xs">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <span className="truncate max-w-[160px]">{a.name}</span>
              <button onClick={() => setAttachments((prev) => prev.filter((x) => x.url !== a.url))} className="text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {gifUrl && (
            <div className="relative">
              <img src={gifUrl} alt="gif" className="h-16 rounded-md" />
              <button onClick={() => setGifUrl(null)} className="absolute -top-1 -right-1 bg-background border rounded-full p-0.5">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {audioUrl && (
            <div className="flex items-center gap-1">
              <audio controls className="h-8 max-w-[200px]"><source src={audioUrl} type="audio/webm" /></audio>
              <button onClick={() => setAudioUrl(null)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}

      <EditorContent editor={editor} />

      <div className="flex items-center gap-0.5 px-2 py-1.5 border-t border-border/40">
        {showAttachments && (
          <Tool title="Attach file" onClick={() => handleAttach("*")} disabled={uploading}>
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
          </Tool>
        )}
        {showImageUpload && (
          <Tool title="Insert image" onClick={() => handleAttach("image/*")}>
            <ImageIcon className="h-3.5 w-3.5" />
          </Tool>
        )}
        {showMentionShortcut && (
          <Tool title="Mention (@)" onClick={() => editor?.chain().focus().insertContent("@").run()}>
            <span className="text-sm font-semibold">@</span>
          </Tool>
        )}
        {showGif && (
          <GiphyPicker onSelect={(url) => setGifUrl(url)}>
            <button className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted text-[10px] font-bold text-muted-foreground/80" title="GIF">
              GIF
            </button>
          </GiphyPicker>
        )}
        {showEmoji && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground/80" title="Emoji">
                <Smile className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <div className="grid grid-cols-8 gap-1">
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => insertEmoji(e)} className="h-7 w-7 rounded hover:bg-muted text-base">
                    {e}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
        {showVoice && (
          recording ? (
            <Tool title="Stop recording" onClick={stopRecording} className="text-destructive animate-pulse">
              <Square className="h-3.5 w-3.5" />
            </Tool>
          ) : audioUploading ? (
            <Tool title="Uploading…" disabled>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            </Tool>
          ) : (
            <Tool title="Record voice note" onClick={startRecording}>
              <Mic className="h-3.5 w-3.5" />
            </Tool>
          )
        )}

        {!hideSendButton && (
          <div className="ml-auto">
            <Button
              size="sm"
              className="h-7 gap-1"
              onClick={() => void submit()}
              disabled={submitting}
              title="Send (⌘/Ctrl+Enter)"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Tool({
  children, onClick, title, disabled, className,
}: { children: React.ReactNode; onClick?: () => void; title: string; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground/80 disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}
