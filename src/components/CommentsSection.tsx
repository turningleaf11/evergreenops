import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Reply, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { RichCommentInput, AttachmentChips, type CommentAttachment } from "@/components/shared/RichCommentInput";
import { CommentReactions } from "@/components/shared/CommentReactions";

interface Comment {
  id: string;
  entity_type: string;
  entity_id: string;
  author_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  attachments?: CommentAttachment[];
  mentions?: string[];
}

interface CommentsSectionProps {
  entityType: string;
  entityId: string;
}

export default function CommentsSection({ entityType, entityId }: CommentsSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from("comments")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: true });
    if (data) {
      const normalized = (data as any[]).map((c) => ({
        ...c,
        attachments: Array.isArray(c.attachments) ? c.attachments : [],
        mentions: Array.isArray(c.mentions) ? c.mentions : [],
      })) as Comment[];
      setComments(normalized);
      const ids = [...new Set(normalized.map((c) => c.author_id))];
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", ids);
        if (profs) {
          const map: Record<string, string> = {};
          profs.forEach((p) => { map[p.user_id] = p.full_name || "Unknown"; });
          setProfiles(map);
        }
      }
    }
  }, [entityType, entityId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const submitComment = async (
    payload: { content: string; attachments: CommentAttachment[]; mentions: string[] },
    parentId: string | null = null,
  ) => {
    if ((!payload.content && payload.attachments.length === 0) || !user) return;
    setSubmitting(true);
    const { error } = await supabase.from("comments").insert({
      entity_type: entityType,
      entity_id: entityId,
      author_id: user.id,
      content: payload.content,
      parent_id: parentId,
      attachments: payload.attachments as any,
      mentions: payload.mentions as any,
    } as any);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      if (parentId) setReplyTo(null);
      fetchComments();
    }
    setSubmitting(false);
  };

  const deleteComment = async (id: string) => {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchComments();
  };

  const topLevel = comments.filter((c) => !c.parent_id);
  const replies = (parentId: string) => comments.filter((c) => c.parent_id === parentId);

  const initials = (name: string) => name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const timeAgo = (d: string) => {
    const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const CommentItem = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => {
    const name = profiles[comment.author_id] || "Unknown";
    const isAuthor = user?.id === comment.author_id;
    return (
      <div className={`flex gap-3 ${isReply ? "ml-10" : ""}`}>
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{name}</span>
            <span className="text-xs text-muted-foreground">{timeAgo(comment.created_at)}</span>
          </div>
          {comment.content && (
            <p className="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap">{comment.content}</p>
          )}
          <AttachmentChips attachments={comment.attachments || []} />
          <div className="flex items-center gap-3 mt-1.5">
            <CommentReactions commentId={comment.id} />
            {!isReply && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
              >
                <Reply className="h-3 w-3" /> Reply
              </button>
            )}
            {isAuthor && (
              <button
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                onClick={() => deleteComment(comment.id)}
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            )}
          </div>
          {replyTo === comment.id && (
            <div className="mt-2">
              <RichCommentInput
                placeholder="Write a reply..."
                compact
                autoFocus
                submitting={submitting}
                onSubmit={(p) => submitComment(p, comment.id)}
              />
            </div>
          )}
          {replies(comment.id).map((r) => (
            <div key={r.id} className="mt-3">
              <CommentItem comment={r} isReply />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Comments ({comments.length})</h3>
      </div>

      <div className="space-y-4">
        {topLevel.map((c) => (
          <CommentItem key={c.id} comment={c} />
        ))}
      </div>

      <div className="pt-2 border-t">
        <RichCommentInput
          placeholder="Write a comment..."
          submitting={submitting}
          onSubmit={(p) => submitComment(p)}
        />
      </div>
    </div>
  );
}
