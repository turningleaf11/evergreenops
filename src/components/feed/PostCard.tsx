import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ReactionBar } from "./ReactionBar";
import { ReplyThread } from "./ReplyThread";

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
}

export function PostCard({ post }: PostCardProps) {
  const initials = (post.author_name || "U").split(" ").map((n) => n[0]).join("");

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="text-xs bg-muted">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">{post.author_name || "Unknown"}</p>
          <p className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>

      {post.content && (
        <p className="text-sm whitespace-pre-wrap">{post.content}</p>
      )}

      {post.image_url && (
        <img
          src={post.image_url}
          alt="Post image"
          className="rounded-lg w-full max-h-96 object-cover"
        />
      )}

      {post.gif_url && (
        <img
          src={post.gif_url}
          alt="GIF"
          className="rounded-lg w-full max-h-96 object-cover"
        />
      )}

      <ReactionBar entityType="post" entityId={post.id} />
      <ReplyThread entityType="post" entityId={post.id} />
    </div>
  );
}
