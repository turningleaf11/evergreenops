import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Reply {
  id: string;
  user_id: string;
  author_name: string | null;
  content: string;
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
  const [submitting, setSubmitting] = useState(false);

  const fetchReplies = async () => {
    const { data } = await supabase
      .from("post_replies")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: true });
    if (data) setReplies(data);
  };

  useEffect(() => { fetchReplies(); }, [entityType, entityId]);

  const submit = async () => {
    if (!user || !draft.trim()) return;
    setSubmitting(true);
    await supabase.from("post_replies").insert({
      entity_type: entityType,
      entity_id: entityId,
      user_id: user.id,
      author_name: profile?.full_name || "Unknown",
      content: draft.trim(),
    });
    setDraft("");
    setSubmitting(false);
    fetchReplies();
  };

  const deleteReply = async (id: string) => {
    await supabase.from("post_replies").delete().eq("id", id);
    fetchReplies();
  };

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        {replies.length > 0 ? `${replies.length} ${replies.length === 1 ? "reply" : "replies"}` : "Reply"}
      </button>

      {expanded && (
        <div className="pl-4 border-l-2 border-border/50 space-y-3 mt-2">
          {replies.map((r) => (
            <div key={r.id} className="flex gap-2 group">
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
                <p className="text-sm text-foreground/90">{r.content}</p>
              </div>
            </div>
          ))}

          <div className="flex gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a reply..."
              className="min-h-[60px] text-sm resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
              }}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={submit}
              disabled={!draft.trim() || submitting}
              className="shrink-0 self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
