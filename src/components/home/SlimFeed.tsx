import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { MessageSquare, Maximize2, Heart, Megaphone, BarChart3, Pin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { FeedComposer } from "@/components/feed/FeedComposer";

const LIMIT = 5;

interface FeedItem {
  type: "post" | "announcement" | "poll" | "kudos";
  id: string;
  created_at: string;
  author_id?: string | null;
  author_name?: string | null;
  title?: string | null;
  content?: string | null;
  pinned?: boolean;
  to_user_id?: string;
  from_user_id?: string;
  gif_url?: string | null;
  image_url?: string | null;
}

const typeMeta = {
  post: { icon: MessageSquare, color: "text-muted-foreground" },
  announcement: { icon: Megaphone, color: "text-primary" },
  poll: { icon: BarChart3, color: "text-blue-500" },
  kudos: { icon: Heart, color: "text-rose-500" },
};

export function SlimFeed() {
  const { profile, user } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [people, setPeople] = useState<{ user_id: string; full_name: string | null }[]>([]);

  const fetchFeed = useCallback(async () => {
    const [annRes, pollRes, kudosRes, postsRes, profRes] = await Promise.all([
      supabase.from("announcements").select("id, title, content, author_id, author_name, created_at, pinned").order("created_at", { ascending: false }).limit(LIMIT),
      supabase.from("polls").select("id, title, description, created_by, created_at").order("created_at", { ascending: false }).limit(LIMIT),
      supabase.from("kudos").select("id, from_user_id, to_user_id, message, created_at").order("created_at", { ascending: false }).limit(LIMIT),
      supabase.from("posts").select("id, author_id, author_name, content, created_at, gif_url, image_url").order("created_at", { ascending: false }).limit(LIMIT),
      supabase.from("profiles").select("user_id, full_name"),
    ]);

    if (profRes.data) {
      const map: Record<string, string> = {};
      profRes.data.forEach((p: any) => { map[p.user_id] = p.full_name || "Teammate"; });
      setProfiles(map);
    }

    const list: FeedItem[] = [];
    annRes.data?.forEach((a: any) => list.push({ type: "announcement", id: a.id, created_at: a.created_at, title: a.title, content: a.content, author_id: a.author_id, author_name: a.author_name, pinned: a.pinned }));
    pollRes.data?.forEach((p: any) => list.push({ type: "poll", id: p.id, created_at: p.created_at, title: p.title, content: p.description, author_id: p.created_by }));
    kudosRes.data?.forEach((k: any) => list.push({ type: "kudos", id: k.id, created_at: k.created_at, content: k.message, from_user_id: k.from_user_id, to_user_id: k.to_user_id }));
    postsRes.data?.forEach((p: any) => list.push({ type: "post", id: p.id, created_at: p.created_at, content: p.content, author_id: p.author_id, author_name: p.author_name, gif_url: p.gif_url, image_url: p.image_url }));

    list.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    setItems(list.slice(0, LIMIT));
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const initials = (profile?.full_name || "U").split(" ").map((n) => n[0]).join("");

  const stripHtml = (html: string | null | undefined) =>
    (html || "").replace(/<[^>]+>/g, "").trim();

  const renderLine = (item: FeedItem) => {
    if (item.type === "kudos") {
      const from = profiles[item.from_user_id || ""] || "Someone";
      const to = profiles[item.to_user_id || ""] || "a teammate";
      return (
        <>
          <span className="font-medium">{from}</span>
          <span className="text-muted-foreground"> recognized </span>
          <span className="font-medium">{to}</span>
        </>
      );
    }
    const author = item.author_name || profiles[item.author_id || ""] || "Someone";
    if (item.type === "announcement") {
      return (
        <>
          <span className="font-medium">{author}</span>
          <span className="text-muted-foreground"> announced </span>
          <span className="font-medium">{item.title}</span>
        </>
      );
    }
    if (item.type === "poll") {
      return (
        <>
          <span className="font-medium">{author}</span>
          <span className="text-muted-foreground"> created a poll · </span>
          <span>{item.title}</span>
        </>
      );
    }
    return (
      <>
        <span className="font-medium">{author}</span>
        <span className="text-muted-foreground"> posted</span>
      </>
    );
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground/70" /> Company Feed
          </h2>
          <Link
            to="/feed"
            className="h-7 w-7 rounded-md hover:bg-muted/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title="Open full feed"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Post trigger */}
        <Link
          to="/feed"
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors border border-border/40"
        >
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground flex-1">What's on your mind?</span>
          <span className="text-[10px] text-primary font-medium">Post →</span>
        </Link>

        {items.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-xs">
            Nothing yet — be the first to share something.
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {items.map((item) => {
              const Meta = typeMeta[item.type];
              const Icon = Meta.icon;
              const text = stripHtml(item.content);
              return (
                <Link
                  key={`${item.type}-${item.id}`}
                  to="/feed"
                  className="flex items-start gap-2.5 py-2.5 hover:bg-muted/30 -mx-2 px-2 rounded-md transition-colors"
                >
                  <div className={`h-7 w-7 rounded-full bg-muted/60 flex items-center justify-center shrink-0 ${Meta.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-snug flex items-center gap-1.5 flex-wrap">
                      {item.pinned && <Pin className="h-3 w-3 text-primary fill-primary/20" />}
                      {renderLine(item)}
                    </p>
                    {text && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-3 leading-relaxed">{text}</p>
                    )}
                    {(item.gif_url || item.image_url) && (
                      <div className="mt-1.5 rounded-md overflow-hidden border border-border/30 max-w-[240px]">
                        <img
                          src={item.gif_url || item.image_url || ""}
                          alt=""
                          className="w-full max-h-[140px] object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
