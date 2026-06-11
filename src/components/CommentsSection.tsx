import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvatar } from "@/components/ui/UserAvatar";
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
  hideHeader?: boolean;
}

export default function CommentsSection({ entityType, entityId, hideHeader = false }: CommentsSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string | null>>({});
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
          .select("user_id, full_name, avatar_url")
          .in("user_id", ids);
        if (profs) {
          const map: Record<string, string> = {};
          const urlMap: Record<string, string | null> = {};
          profs.forEach((p: any) => {
            map[p.user_id] = p.full_name || "Unknown";
            urlMap[p.user_id] = p.avatar_url || null;
          });
          setProfiles(map);
          setAvatarUrls(urlMap);
        }
      }
    }
  }, [entityType, entityId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

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
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
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

  const initials = (name: string) =>
    name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const timeAgo = (date: string) => {
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
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
        <UserAvatar name={name} avatarUrl={avatarUrls[comment.author_id]} className="h-7 w-7 shrink-0" fallbackClassName="bg-primary/10 text-[10px] text-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{name}</span>
            <span className="text-xs text-muted-foreground">{timeAgo(comment.created_at)}</span>
          </div>
          {comment.content && <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground/90">{comment.content}</p>}
          <AttachmentChips attachments={comment.attachments || []} />
          <div className="mt-1.5 flex items-center gap-3">
            <CommentReactions commentId={comment.id} />
            {!isReply && (
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
              >
                <Reply className="h-3 w-3" /> Reply
              </button>
            )}
            {isAuthor && (
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
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
                onSubmit={(payload) => submitComment(payload, comment.id)}
              />
            </div>
          )}
          {replies(comment.id).map((reply) => (
            <div key={reply.id} className="mt-3">
              <CommentItem comment={reply} isReply />
            </div>
          ))}
        </div>
      </div>
    );
  };

  // When `hideHeader` is set, we're embedded in a height-constrained surface
  // (rail, peek, drawer) — anchor the composer to the bottom and scroll the feed.
  // Otherwise lay out naturally so inline detail panels (issues, drawers, etc.) keep flowing.
  if (hideHeader) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <div className="space-y-4 pb-2">
            {topLevel.map((comment) => (
              <CommentItem key={comment.id} comment={comment} />
            ))}
            {topLevel.length === 0 && (
              <p className="text-sm text-muted-foreground">No comments yet.</p>
            )}
          </div>
        </div>
        <div className="shrink-0 border-t pt-3 mt-3 bg-background">
          <RichCommentInput
            placeholder="Write a comment..."
            submitting={submitting}
            onSubmit={(payload) => submitComment(payload)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Comments ({comments.length})</h3>
      </div>

      <div className="space-y-4">
        {topLevel.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
        {topLevel.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
      </div>

      <div className="border-t pt-3">
        <RichCommentInput
          placeholder="Write a comment..."
          submitting={submitting}
          onSubmit={(payload) => submitComment(payload)}
        />
      </div>
    </div>
  );
}
