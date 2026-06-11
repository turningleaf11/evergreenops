import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { ArrowRight, MessageSquare } from "lucide-react";
import { PostCard } from "@/components/feed/PostCard";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { formatDistanceToNow } from "date-fns";

interface FeedPreviewProps {
  variant?: "vertical" | "horizontal";
}

export function FeedPreview({ variant = "vertical" }: FeedPreviewProps) {
  const [posts, setPosts] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(variant === "horizontal" ? 8 : 3);
    if (data) setPosts(data);
  };

  useEffect(() => { load(); }, [variant]);

  if (variant === "horizontal") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" /> Latest from the team
          </h2>
          <Link to="/feed" className="text-xs text-primary hover:underline flex items-center gap-1">
            View feed <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/40 py-6 text-center text-sm text-muted-foreground">
            No posts yet.
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto snap-x pb-2 -mx-1 px-1">
            {posts.map((post) => {
              const initials = (post.author_name || "U").split(" ").map((n: string) => n[0]).join("");
              return (
                <Link
                  key={post.id}
                  to="/feed"
                  className="snap-start shrink-0 w-[280px] rounded-xl border border-border/40 bg-card hover:border-border hover:shadow-sm transition-all p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <UserAvatar name={post.author_name} avatarUrl={undefined} className="h-7 w-7" fallbackClassName="text-[10px] bg-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{post.author_name || "Unknown"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  {post.content && (
                    <p className="text-xs text-foreground/90 line-clamp-3">{post.content}</p>
                  )}
                  {(post.image_url || post.gif_url) && (
                    <img
                      src={post.image_url || post.gif_url}
                      alt=""
                      className="rounded-lg w-full h-24 object-cover"
                    />
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground/70" /> Feed
        </h2>
        <Link to="/feed" className="text-xs text-primary hover:underline flex items-center gap-1">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {posts.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">No posts yet.</p>
      )}
      {posts.map((post) => (
        <PostCard key={post.id} post={post} onRefresh={load} />
      ))}
    </div>
  );
}
