import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Link } from "react-router-dom";
import { ArrowRight, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { useRef } from "react";

export function FeedCarousel() {
  const [posts, setPosts] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("posts")
      .select("id, author_name, content, image_url, gif_url, created_at")
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (data) setPosts(data);
      });
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
            return (
              <Link
                to="/feed"
                key={post.id}
                className="snap-start shrink-0 w-[260px] rounded-xl border bg-card hover:border-primary/30 transition-colors overflow-hidden group"
              >
                {media && (
                  <div className="h-28 overflow-hidden">
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
                  <p className="text-xs text-foreground/80 line-clamp-3 leading-relaxed">
                    {post.content || "Shared a post"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
