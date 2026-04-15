import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, Send, Trash2, ChevronDown, ChevronUp, Mic, Square, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ReactionBar } from "./ReactionBar";
import { GiphyPicker } from "./GiphyPicker";
import { toast } from "sonner";
import { uploadFile } from "@/lib/file-upload";

interface Reply {
  id: string;
  user_id: string;
  author_name: string | null;
  content: string;
  gif_url: string | null;
  audio_url: string | null;
  created_at: string;
}

interface ReplyThreadProps {
  entityType: string;
  entityId: string;
}

export function ReplyThread({ entityType, entityId }: ReplyThreadProps) {
  const { user, profile } = useAuth();
  const [replies, setReplies] = useState<Reply[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftGif, setDraftGif] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Voice recording
  const [recording, setRecording] = useState(false);
  const [audioUploading, setAudioUploading] = useState(false);
  const [draftAudioUrl, setDraftAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const fetchReplies = async () => {
    const { data } = await supabase
      .from("post_replies")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: true });
    if (data) setReplies(data as Reply[]);
  };

  useEffect(() => { fetchReplies(); }, [entityType, entityId]);

  const submit = async () => {
    if (!user || (!draft.trim() && !draftGif && !draftAudioUrl)) return;
    setSubmitting(true);
    await supabase.from("post_replies").insert({
      entity_type: entityType,
      entity_id: entityId,
      user_id: user.id,
      author_name: profile?.full_name || "Unknown",
      content: draft.trim(),
      gif_url: draftGif,
      audio_url: draftAudioUrl,
    } as any);
    setDraft("");
    setDraftGif(null);
    setDraftAudioUrl(null);
    setSubmitting(false);
    fetchReplies();
  };

  const deleteReply = async (id: string) => {
    await supabase.from("post_replies").delete().eq("id", id);
    fetchReplies();
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
        if (url) setDraftAudioUrl(url);
        else toast.error("Audio upload failed");
        setAudioUploading(false);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const previewReply = replies[0];
  const hasReplies = replies.length > 0;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        {hasReplies ? (
          <span className="flex items-center gap-1">
            {replies.length} {replies.length === 1 ? "reply" : "replies"}
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </span>
        ) : "Reply"}
      </button>

      {/* Collapsed preview */}
      {!expanded && hasReplies && previewReply && (
        <button onClick={() => setExpanded(true)} className="pl-4 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[8px] bg-muted">
              {(previewReply.author_name || "U")[0]}
            </AvatarFallback>
          </Avatar>
          <span className="truncate max-w-[200px]">{previewReply.content || "Sent media"}</span>
          {replies.length > 1 && <span className="text-primary">View all</span>}
        </button>
      )}

      {expanded && (
        <div className="pl-4 border-l-2 border-border/50 space-y-3 mt-2">
          {replies.map((r) => (
            <div key={r.id} className="space-y-1">
              <div className="flex gap-2 group">
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarFallback className="text-[10px] bg-muted">
                    {(r.author_name || "U").split(" ").map((n) => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{r.author_name || "Unknown"}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </span>
                    {r.user_id === user?.id && (
                      <button
                        onClick={() => deleteReply(r.id)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {r.content && <p className="text-sm text-foreground/90">{r.content}</p>}
                  {r.gif_url && <img src={r.gif_url} alt="GIF" className="rounded-md max-h-36 mt-1" />}
                  {r.audio_url && (
                    <audio controls className="mt-1 h-8 max-w-[240px]">
                      <source src={r.audio_url} type="audio/webm" />
                    </audio>
                  )}
                </div>
              </div>
              <div className="pl-8">
                <ReactionBar entityType="reply" entityId={r.id} />
              </div>
            </div>
          ))}

          {/* Compose reply */}
          <div className="space-y-2">
            {draftGif && (
              <div className="relative inline-block">
                <img src={draftGif} alt="GIF" className="rounded-md max-h-24" />
                <button onClick={() => setDraftGif(null)} className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}
            {draftAudioUrl && (
              <div className="flex items-center gap-2">
                <audio controls className="h-8 max-w-[200px]"><source src={draftAudioUrl} type="audio/webm" /></audio>
                <button onClick={() => setDraftAudioUrl(null)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
              </div>
            )}
            <div className="flex gap-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a reply..."
                className="min-h-[50px] text-sm resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
                }}
              />
              <div className="flex flex-col gap-1 shrink-0 self-end">
                <GiphyPicker onSelect={(url) => setDraftGif(url)}>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-[10px] font-bold text-muted-foreground">
                    GIF
                  </Button>
                </GiphyPicker>
                {recording ? (
                  <Button size="icon" variant="ghost" onClick={stopRecording} className="h-7 w-7 text-red-500 animate-pulse">
                    <Square className="h-3.5 w-3.5" />
                  </Button>
                ) : audioUploading ? (
                  <Button size="icon" variant="ghost" disabled className="h-7 w-7">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  </Button>
                ) : (
                  <Button size="icon" variant="ghost" onClick={startRecording} className="h-7 w-7 text-muted-foreground">
                    <Mic className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={submit}
                  disabled={(!draft.trim() && !draftGif && !draftAudioUrl) || submitting}
                  className="h-7 w-7"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
