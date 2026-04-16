import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ReactionBar } from "./ReactionBar";
import { ReplyThread } from "./ReplyThread";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface PostCardProps {
  post: {
    id: string;
    author_id: string;
    author_name: string | null;
    content: string;
    image_url: string | null;
    gif_url: string | null;
    created_at: string;
  };
  onRefresh?: () => void;
}

export function PostCard({ post, onRefresh }: PostCardProps) {
  const { user, isAdmin } = useAuth();
  const initials = (post.author_name || "U").split(" ").map((n) => n[0]).join("");
  const isAuthor = user?.id === post.author_id;
  const canManage = isAuthor || isAdmin;

  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);

  const handleDelete = async () => {
    if (!confirm("Delete this post?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) toast.error(error.message);
    else { toast.success("Post deleted"); onRefresh?.(); }
  };

  const handleSaveEdit = async () => {
    const { error } = await supabase
      .from("posts")
      .update({ content: editContent.trim() })
      .eq("id", post.id);
    if (error) toast.error(error.message);
    else { toast.success("Post updated"); setEditing(false); onRefresh?.(); }
  };

  return (
    <div className="rounded-xl border bg-card p-3 space-y-2 group">
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs bg-muted">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{post.author_name || "Unknown"}</p>
          <p className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </p>
        </div>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/70 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { setEditContent(post.content); setEditing(true); }}>
                <Pencil className="h-3.5 w-3.5 mr-2 text-muted-foreground/70" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="min-h-[60px] text-sm resize-none"
          />
          <div className="flex gap-1.5 justify-end">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleSaveEdit}>Save</Button>
          </div>
        </div>
      ) : (
        post.content && <p className="text-sm whitespace-pre-wrap">{post.content}</p>
      )}

      {post.image_url && (
        <img src={post.image_url} alt="Post image" className="rounded-lg w-full max-h-96 object-cover" />
      )}
      {post.gif_url && (
        <img src={post.gif_url} alt="GIF" className="rounded-lg w-full max-h-96 object-cover" />
      )}

      {/* Compact action row — reactions + reply toggle inline */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <ReactionBar entityType="post" entityId={post.id} />
        </div>
        <ReplyThread entityType="post" entityId={post.id} />
      </div>
    </div>
  );
}
