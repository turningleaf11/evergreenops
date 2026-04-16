import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { ArrowRight, MessageSquare } from "lucide-react";
import { PostCard } from "@/components/feed/PostCard";

export function FeedPreview() {
  const [posts, setPosts] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(3);
    if (data) setPosts(data);
  };

  useEffect(() => { load(); }, []);

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
