import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Megaphone, Pin, Plus } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Announcement {
  id: string;
  title: string;
  content: string;
  author_name: string | null;
  pinned: boolean;
  created_at: string;
}

export function AnnouncementsFeed() {
  const { user, profile, isAdmin } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const fetchData = useCallback(async () => {
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setAnnouncements(data as Announcement[]);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createAnnouncement = async () => {
    if (!user || !title.trim()) { toast.error("Add a title"); return; }
    const { error } = await supabase.from("announcements").insert({
      title: title.trim(),
      content: content.trim(),
      author_id: user.id,
      author_name: profile?.full_name || "Unknown",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Announcement posted!");
    setCreateOpen(false);
    setTitle("");
    setContent("");
    fetchData();
  };

  const togglePin = async (id: string, pinned: boolean) => {
    await supabase.from("announcements").update({ pinned: !pinned }).eq("id", id);
    fetchData();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Megaphone className="h-4 w-4" /> Announcements
        </h2>
        {isAdmin && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3 w-3 mr-1" /> Post
          </Button>
        )}
      </div>

      {announcements.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No announcements yet</CardContent></Card>
      ) : (
        announcements.map(a => (
          <Card key={a.id} className={a.pinned ? "border-primary/30" : ""}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {a.pinned && <Pin className="h-3.5 w-3.5 text-primary shrink-0" />}
                  <p className="font-medium text-sm">{a.title}</p>
                </div>
                {isAdmin && (
                  <button onClick={() => togglePin(a.id, a.pinned)} className="text-muted-foreground hover:text-primary p-1">
                    <Pin className="h-3 w-3" />
                  </button>
                )}
              </div>
              {a.content && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.content}</p>}
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{a.author_name}</span>
                <span>·</span>
                <span>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Post Announcement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Title</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Announcement title" className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Content</label>
              <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Details..." className="mt-1 min-h-[80px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createAnnouncement}>Post</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
