import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Reply, Trash2, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Comment {
  id: string;
  entity_type: string;
  entity_id: string;
  author_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

interface CommentsSectionProps {
  entityType: string;
  entityId: string;
}

export default function CommentsSection({ entityType, entityId }: CommentsSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from("comments")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: true });
    if (data) {
      setComments(data);
      const ids = [...new Set(data.map(c => c.author_id))];
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", ids);
        if (profs) {
          const map: Record<string, string> = {};
          profs.forEach(p => { map[p.user_id] = p.full_name || "Unknown"; });
          setProfiles(map);
        }
      }
    }
  }, [entityType, entityId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const submitComment = async (content: string, parentId: string | null = null) => {
    if (!content.trim() || !user) return;
    setLoading(true);
    const { error } = await supabase.from("comments").insert({
      entity_type: entityType,
      entity_id: entityId,
      author_id: user.id,
      content: content.trim(),
      parent_id: parentId,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      if (parentId) { setReplyText(""); setReplyTo(null); }
      else setNewComment("");
      fetchComments();
    }
    setLoading(false);
  };

  const deleteComment = async (id: string) => {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchComments();
  };

  const topLevel = comments.filter(c => !c.parent_id);
  const replies = (parentId: string) => comments.filter(c => c.parent_id === parentId);

  const initials = (name: string) => name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
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
          <p className="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap">{comment.content}</p>
          <div className="flex items-center gap-2 mt-1">
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
            <div className="flex gap-2 mt-2">
              <Textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                rows={1}
                className="text-sm min-h-[36px]"
              />
              <Button
                size="sm"
                disabled={loading || !replyText.trim()}
                onClick={() => submitComment(replyText, comment.id)}
              >
                <Send className="h-3 w-3" />
              </Button>
            </div>
          )}
          {replies(comment.id).map(r => (
            <CommentItem key={r.id} comment={r} isReply />
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
        {topLevel.map(c => (
          <CommentItem key={c.id} comment={c} />
        ))}
      </div>

      <div className="flex gap-2 pt-2 border-t">
        <Textarea
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          rows={2}
          className="text-sm"
        />
        <Button
          size="sm"
          className="self-end"
          disabled={loading || !newComment.trim()}
          onClick={() => submitComment(newComment)}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
