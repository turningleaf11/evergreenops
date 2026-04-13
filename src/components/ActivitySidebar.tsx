import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  MessageSquare, Activity, Send, Reply, Trash2, PanelRightClose, PanelRightOpen,
  GitCommitHorizontal,
} from "lucide-react";

interface TimelineEvent {
  id: string;
  type: "comment" | "activity";
  actor: string;
  actorId: string | null;
  content: string;
  timestamp: string;
  parentId?: string | null;
  commentId?: string;
}

interface ActivitySidebarProps {
  entityType: string;
  entityId: string;
  collapsed?: boolean;
  onToggle?: () => void;
}

type FilterTab = "all" | "comments" | "activity";

export default function ActivitySidebar({ entityType, entityId, collapsed = false, onToggle }: ActivitySidebarProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    const [commentsRes, activityRes] = await Promise.all([
      supabase.from("comments").select("*").eq("entity_type", entityType).eq("entity_id", entityId).order("created_at", { ascending: true }),
      supabase.from("entity_activity").select("*").eq("entity_type", entityType).eq("entity_id", entityId).order("created_at", { ascending: false }).limit(50),
    ]);

    const allActorIds = new Set<string>();
    const timeline: TimelineEvent[] = [];

    if (commentsRes.data) {
      commentsRes.data.forEach(c => {
        allActorIds.add(c.author_id);
        timeline.push({
          id: c.id,
          type: "comment",
          actor: "",
          actorId: c.author_id,
          content: c.content,
          timestamp: c.created_at,
          parentId: c.parent_id,
          commentId: c.id,
        });
      });
    }

    if (activityRes.data) {
      activityRes.data.forEach(a => {
        if (a.actor_id) allActorIds.add(a.actor_id);
        const meta = (a.metadata as Record<string, any>) || {};
        let desc = a.action.replace(/_/g, " ");
        if (a.action === "status_changed") desc = `changed status to ${meta.new_status || "unknown"}`;
        else if (a.action === "assigned") desc = `assigned to ${meta.assignee_name || "someone"}`;
        else if (a.action === "priority_changed") desc = `changed priority to ${meta.new_priority || "unknown"}`;
        else if (a.action === "created") desc = `created this ${entityType}`;

        timeline.push({
          id: a.id,
          type: "activity",
          actor: "",
          actorId: a.actor_id,
          content: desc,
          timestamp: a.created_at,
        });
      });
    }

    // Fetch profiles
    const ids = [...allActorIds];
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      if (profs) {
        const map: Record<string, string> = {};
        profs.forEach(p => { map[p.user_id] = p.full_name || "Unknown"; });
        setProfiles(map);
      }
    }

    // Sort chronologically (newest first for activity, but we want unified newest-first)
    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setEvents(timeline);
  }, [entityType, entityId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

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
    if (!error) {
      if (parentId) { setReplyText(""); setReplyTo(null); }
      else setNewComment("");
      fetchAll();
    }
    setLoading(false);
  };

  const deleteComment = async (id: string) => {
    await supabase.from("comments").delete().eq("id", id);
    fetchAll();
  };

  const initials = (name: string) => name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const timeAgo = (d: string) => {
    const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const getName = (actorId: string | null) => actorId ? (profiles[actorId] || "Someone") : "System";

  const filtered = events.filter(e => {
    if (filter === "comments") return e.type === "comment";
    if (filter === "activity") return e.type === "activity";
    return true;
  });

  // Separate top-level comments and replies
  const topLevelComments = filtered.filter(e => e.type === "comment" && !e.parentId);
  const getReplies = (parentId: string) => events.filter(e => e.type === "comment" && e.parentId === parentId);

  const renderEvent = (event: TimelineEvent) => {
    const name = getName(event.actorId);

    if (event.type === "activity") {
      return (
        <div key={event.id} className="flex items-start gap-2.5 py-2">
          <GitCommitHorizontal className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/70">{name}</span> {event.content}
            </p>
            <span className="text-[10px] text-muted-foreground/60">{timeAgo(event.timestamp)}</span>
          </div>
        </div>
      );
    }

    // Comment
    return (
      <div key={event.id} className="py-2.5">
        <div className="flex gap-2.5">
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium">{name}</span>
              <span className="text-[10px] text-muted-foreground">{timeAgo(event.timestamp)}</span>
            </div>
            <p className="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap leading-relaxed">{event.content}</p>
            <div className="flex items-center gap-2 mt-1">
              {!event.parentId && (
                <button
                  className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                  onClick={() => setReplyTo(replyTo === event.commentId! ? null : event.commentId!)}
                >
                  <Reply className="h-3 w-3" /> Reply
                </button>
              )}
              {user?.id === event.actorId && (
                <button
                  className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-0.5"
                  onClick={() => deleteComment(event.commentId!)}
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              )}
            </div>
            {replyTo === event.commentId && (
              <div className="flex gap-1.5 mt-2">
                <Textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Reply..."
                  rows={1}
                  className="text-xs min-h-[32px]"
                />
                <Button size="sm" className="h-8 px-2" disabled={loading || !replyText.trim()} onClick={() => submitComment(replyText, event.commentId!)}>
                  <Send className="h-3 w-3" />
                </Button>
              </div>
            )}
            {/* Render replies */}
            {getReplies(event.commentId!).map(reply => (
              <div key={reply.id} className="ml-4 mt-2 pt-2 border-l-2 border-border/40 pl-3">
                <div className="flex gap-2">
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarFallback className="text-[8px] bg-primary/10 text-primary">{initials(getName(reply.actorId))}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium">{getName(reply.actorId)}</span>
                      <span className="text-[10px] text-muted-foreground">{timeAgo(reply.timestamp)}</span>
                    </div>
                    <p className="text-xs text-foreground/90 mt-0.5 whitespace-pre-wrap">{reply.content}</p>
                    {user?.id === reply.actorId && (
                      <button
                        className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-0.5 mt-0.5"
                        onClick={() => deleteComment(reply.commentId!)}
                      >
                        <Trash2 className="h-2.5 w-2.5" /> Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Activity</span>
        </div>
        {!isMobile && onToggle && (
          <button onClick={onToggle} className="text-muted-foreground hover:text-foreground">
            <PanelRightClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 py-2 border-b">
        {(["all", "comments", "activity"] as FilterTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`text-xs px-2.5 py-1 rounded-md transition-colors capitalize ${
              filter === tab ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
        {filter === "all" ? (
          filtered.filter(e => e.type === "activity" || (e.type === "comment" && !e.parentId)).map(renderEvent)
        ) : filter === "comments" ? (
          topLevelComments.map(renderEvent)
        ) : (
          filtered.map(renderEvent)
        )}
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">No activity yet.</p>
        )}
      </div>

      {/* Comment input — sticky bottom */}
      <div className="border-t pt-3 mt-auto">
        <div className="flex gap-1.5">
          <Textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            rows={2}
            className="text-xs min-h-[40px] resize-none"
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(newComment); } }}
          />
          <Button size="sm" className="h-8 px-2 self-end" disabled={loading || !newComment.trim()} onClick={() => submitComment(newComment)}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );

  // Mobile: Sheet
  if (isMobile) {
    return (
      <>
        <Button variant="ghost" size="sm" onClick={() => setMobileOpen(true)} className="fixed bottom-4 right-4 z-40 rounded-full h-10 w-10 p-0 bg-primary text-primary-foreground shadow-lg">
          <MessageSquare className="h-4 w-4" />
        </Button>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="right" className="w-full sm:max-w-sm p-4">
            <SheetHeader>
              <SheetTitle>Activity</SheetTitle>
            </SheetHeader>
            <div className="mt-4 h-[calc(100vh-8rem)]">
              {sidebarContent}
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  // Desktop: collapsed toggle
  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="flex items-center justify-center w-10 h-10 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        title="Open activity"
      >
        <PanelRightOpen className="h-4 w-4" />
      </button>
    );
  }

  // Desktop: open sidebar
  return (
    <div className="w-[340px] shrink-0 border-l pl-5 h-full">
      {sidebarContent}
    </div>
  );
}
