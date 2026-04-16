import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Link } from "react-router-dom";
import { ArrowRight, MessageSquare, ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

export function FeedCarousel() {
  const [posts, setPosts] = useState<any[]>([]);
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("posts")
        .select("id, author_name, content, image_url, gif_url, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      if (data) {
        setPosts(data);
        // Fetch reply and reaction counts
        const ids = data.map((p) => p.id);
        if (ids.length > 0) {
          const [repliesRes, reactionsRes] = await Promise.all([
            supabase
              .from("post_replies")
              .select("entity_id")
              .eq("entity_type", "post")
              .in("entity_id", ids),
            supabase
              .from("post_reactions")
              .select("entity_id")
              .eq("entity_type", "post")
              .in("entity_id", ids),
          ]);
          const rc: Record<string, number> = {};
          (repliesRes.data || []).forEach((r: any) => {
            rc[r.entity_id] = (rc[r.entity_id] || 0) + 1;
          });
          setReplyCounts(rc);
          const rxc: Record<string, number> = {};
          (reactionsRes.data || []).forEach((r: any) => {
            rxc[r.entity_id] = (rxc[r.entity_id] || 0) + 1;
          });
          setReactionCounts(rxc);
        }
      }
    };
    load();
  }, []);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = 300;
    scrollRef.current.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Feed
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => scroll("left")}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => scroll("right")}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Link to="/feed" className="text-xs text-primary hover:underline flex items-center gap-1 ml-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto px-4 pb-4 snap-x snap-mandatory scrollbar-hide"
          style={{ scrollbarWidth: "none" }}
        >
          {posts.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">No posts yet.</p>
          )}
          {posts.map((post) => {
            const initials = (post.author_name || "U").split(" ").map((n: string) => n[0]).join("");
            const media = post.image_url || post.gif_url;
            const replies = replyCounts[post.id] || 0;
            const reactions = reactionCounts[post.id] || 0;
            return (
              <Link
                to="/feed"
                key={post.id}
                className="snap-start shrink-0 w-[280px] rounded-xl border bg-card hover:border-primary/30 transition-colors overflow-hidden group"
              >
                {media && (
                  <div className="h-32 overflow-hidden">
                    <img
                      src={media}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[9px] bg-muted">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-medium block truncate">{post.author_name || "Unknown"}</span>
                      <span className="text-[9px] text-muted-foreground">
                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-foreground/80 line-clamp-4 leading-relaxed">
                    {post.content?.substring(0, 150) || "Shared a post"}
                  </p>
                  {(replies > 0 || reactions > 0) && (
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1 border-t border-border/30">
                      {reactions > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Heart className="h-3 w-3" /> {reactions}
                        </span>
                      )}
                      {replies > 0 && (
                        <span className="flex items-center gap-0.5">
                          <MessageSquare className="h-3 w-3" /> {replies}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
