import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FeedCard, FeedItem } from "@/components/feed/FeedCard";
import { FeedComposer } from "@/components/feed/FeedComposer";
import { Megaphone } from "lucide-react";

export default function CompanyFeedPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<{ user_id: string; full_name: string | null }[]>([]);

  useEffect(() => {
    fetchFeed();
    supabase.from("profiles").select("user_id, full_name").then(({ data }) => {
      if (data) setPeople(data.filter((p) => p.user_id !== user?.id));
    });
  }, []);

  const fetchFeed = async () => {
    setLoading(true);
    const [annRes, pollRes, kudosRes, postsRes] = await Promise.all([
      supabase.from("announcements").select("*").order("created_at", { ascending: false }),
      supabase.from("polls").select("*").order("created_at", { ascending: false }),
      supabase.from("kudos").select("*").order("created_at", { ascending: false }),
      supabase.from("posts").select("*").order("created_at", { ascending: false }),
    ]);

    const feedItems: FeedItem[] = [];
    annRes.data?.forEach((a) => feedItems.push({ type: "announcement", data: a, created_at: a.created_at }));
    pollRes.data?.forEach((p) => feedItems.push({ type: "poll", data: p, created_at: p.created_at }));
    kudosRes.data?.forEach((k) => feedItems.push({ type: "kudos", data: k, created_at: k.created_at }));
    postsRes.data?.forEach((p) => feedItems.push({ type: "post", data: p, created_at: p.created_at }));

    // Pinned announcements first, then by date
    feedItems.sort((a, b) => {
      const aPinned = a.type === "announcement" && a.data.pinned;
      const bPinned = b.type === "announcement" && b.data.pinned;
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setItems(feedItems);
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-8 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Feed</h1>
        <p className="text-sm text-muted-foreground">Posts, announcements, polls, and recognition</p>
      </div>

      <FeedComposer onPost={fetchFeed} people={people} />

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No posts yet. Be the first to share something!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <FeedCard key={`${item.type}-${item.data.id}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
