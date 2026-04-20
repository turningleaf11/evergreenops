import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowRight, MessageSquare } from "lucide-react";
import { FeedComposer } from "@/components/feed/FeedComposer";
import { FeedCard, type FeedItem } from "@/components/feed/FeedCard";

const LIMIT = 4;

export function InlineFeed() {
  const { user } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [people, setPeople] = useState<{ user_id: string; full_name: string | null }[]>([]);

  const fetchFeed = useCallback(async () => {
    const [annRes, pollRes, kudosRes, postsRes] = await Promise.all([
      supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(LIMIT),
      supabase.from("polls").select("*").order("created_at", { ascending: false }).limit(LIMIT),
      supabase.from("kudos").select("*").order("created_at", { ascending: false }).limit(LIMIT),
      supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(LIMIT),
    ]);

    const feedItems: FeedItem[] = [];
    annRes.data?.forEach((a) => feedItems.push({ type: "announcement", data: a, created_at: a.created_at }));
    pollRes.data?.forEach((p) => feedItems.push({ type: "poll", data: p, created_at: p.created_at }));
    kudosRes.data?.forEach((k) => feedItems.push({ type: "kudos", data: k, created_at: k.created_at }));
    postsRes.data?.forEach((p) => feedItems.push({ type: "post", data: p, created_at: p.created_at }));

    feedItems.sort((a, b) => {
      const aPinned = a.type === "announcement" && (a.data as any).pinned;
      const bPinned = b.type === "announcement" && (b.data as any).pinned;
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setItems(feedItems.slice(0, LIMIT));
  }, []);

  useEffect(() => {
    fetchFeed();
    supabase.from("profiles").select("user_id, full_name").then(({ data }) => {
      if (data) setPeople(data.filter((p) => p.user_id !== user?.id));
    });
  }, [fetchFeed, user?.id]);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground/70" /> Company Feed
          </h2>
          <Link to="/feed" className="text-xs text-primary hover:underline flex items-center gap-1">
            Open full feed <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <FeedComposer onPost={fetchFeed} people={people} />

        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nothing yet — be the first to share something with the team.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <FeedCard key={`${item.type}-${item.data.id}`} item={item} onRefresh={fetchFeed} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
