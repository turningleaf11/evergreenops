import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FeedCard, FeedItem } from "@/components/feed/FeedCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Megaphone, BarChart3, Heart } from "lucide-react";
import { toast } from "sonner";

export default function CompanyFeedPage() {
  const { user, profile, isAdmin } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createType, setCreateType] = useState<"announcement" | "poll" | "kudos">("announcement");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Announcement form
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [annType, setAnnType] = useState("general");
  const [annPinned, setAnnPinned] = useState(false);

  // Poll form
  const [pollTitle, setPollTitle] = useState("");
  const [pollDesc, setPollDesc] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  // Kudos form
  const [kudosTo, setKudosTo] = useState("");
  const [kudosMsg, setKudosMsg] = useState("");
  const [kudosCat, setKudosCat] = useState("great_work");
  const [people, setPeople] = useState<{ user_id: string; full_name: string | null }[]>([]);

  useEffect(() => {
    fetchFeed();
    supabase.from("profiles").select("user_id, full_name").then(({ data }) => {
      if (data) setPeople(data.filter((p) => p.user_id !== user?.id));
    });
  }, []);

  const fetchFeed = async () => {
    setLoading(true);
    const [annRes, pollRes, kudosRes] = await Promise.all([
      supabase.from("announcements").select("*").order("created_at", { ascending: false }),
      supabase.from("polls").select("*").order("created_at", { ascending: false }),
      supabase.from("kudos").select("*").order("created_at", { ascending: false }),
    ]);

    const feedItems: FeedItem[] = [];
    annRes.data?.forEach((a) => feedItems.push({ type: "announcement", data: a, created_at: a.created_at }));
    pollRes.data?.forEach((p) => feedItems.push({ type: "poll", data: p, created_at: p.created_at }));
    kudosRes.data?.forEach((k) => feedItems.push({ type: "kudos", data: k, created_at: k.created_at }));

    // Sort pinned announcements first, then by date
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

  const submitAnnouncement = async () => {
    if (!annTitle.trim()) return;
    await supabase.from("announcements").insert({
      title: annTitle.trim(),
      content: annContent.trim(),
      type: annType,
      pinned: annPinned,
      author_id: user?.id,
      author_name: profile?.full_name,
    });
    setAnnTitle(""); setAnnContent(""); setAnnType("general"); setAnnPinned(false);
    setDialogOpen(false);
    toast.success("Announcement posted");
    fetchFeed();
  };

  const submitPoll = async () => {
    if (!pollTitle.trim() || pollOptions.filter(Boolean).length < 2) return;
    await supabase.from("polls").insert({
      title: pollTitle.trim(),
      description: pollDesc.trim(),
      options: pollOptions.filter(Boolean),
      created_by: user?.id,
    });
    setPollTitle(""); setPollDesc(""); setPollOptions(["", ""]);
    setDialogOpen(false);
    toast.success("Poll created");
    fetchFeed();
  };

  const submitKudos = async () => {
    if (!kudosTo) return;
    await supabase.from("kudos").insert({
      from_user_id: user!.id,
      to_user_id: kudosTo,
      message: kudosMsg.trim(),
      category: kudosCat,
    });
    setKudosTo(""); setKudosMsg(""); setKudosCat("great_work");
    setDialogOpen(false);
    toast.success("Kudos sent! 🎉");
    fetchFeed();
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Company Feed</h1>
          <p className="text-sm text-muted-foreground">Announcements, polls, and recognition</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Post
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Post</DialogTitle>
            </DialogHeader>

            <div className="flex gap-1 mb-4">
              {isAdmin && (
                <>
                  <Button
                    variant={createType === "announcement" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCreateType("announcement")}
                    className="gap-1"
                  >
                    <Megaphone className="h-3.5 w-3.5" />
                    Announcement
                  </Button>
                  <Button
                    variant={createType === "poll" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCreateType("poll")}
                    className="gap-1"
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    Poll
                  </Button>
                </>
              )}
              <Button
                variant={createType === "kudos" ? "default" : "outline"}
                size="sm"
                onClick={() => setCreateType("kudos")}
                className="gap-1"
              >
                <Heart className="h-3.5 w-3.5" />
                Kudos
              </Button>
            </div>

            {createType === "announcement" && isAdmin && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select value={annType} onValueChange={setAnnType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="urgent">🚨 Urgent</SelectItem>
                      <SelectItem value="celebration">🎉 Celebration</SelectItem>
                      <SelectItem value="update">🔄 Update</SelectItem>
                      <SelectItem value="policy">📋 Policy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input placeholder="Title" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} />
                <Textarea placeholder="Content..." value={annContent} onChange={(e) => setAnnContent(e.target.value)} className="min-h-[100px]" />
                <div className="flex items-center gap-2">
                  <Switch checked={annPinned} onCheckedChange={setAnnPinned} />
                  <Label className="text-xs">Pin to top</Label>
                </div>
                <Button onClick={submitAnnouncement} className="w-full" disabled={!annTitle.trim()}>Post Announcement</Button>
              </div>
            )}

            {createType === "poll" && isAdmin && (
              <div className="space-y-3">
                <Input placeholder="Poll question" value={pollTitle} onChange={(e) => setPollTitle(e.target.value)} />
                <Textarea placeholder="Description (optional)" value={pollDesc} onChange={(e) => setPollDesc(e.target.value)} className="min-h-[60px]" />
                <div className="space-y-2">
                  <Label className="text-xs">Options</Label>
                  {pollOptions.map((opt, i) => (
                    <Input
                      key={i}
                      placeholder={`Option ${i + 1}`}
                      value={opt}
                      onChange={(e) => {
                        const next = [...pollOptions];
                        next[i] = e.target.value;
                        setPollOptions(next);
                      }}
                    />
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setPollOptions([...pollOptions, ""])}>
                    + Add option
                  </Button>
                </div>
                <Button onClick={submitPoll} className="w-full" disabled={!pollTitle.trim() || pollOptions.filter(Boolean).length < 2}>
                  Create Poll
                </Button>
              </div>
            )}

            {createType === "kudos" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">To</Label>
                  <Select value={kudosTo} onValueChange={setKudosTo}>
                    <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
                    <SelectContent>
                      {people.map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id}>
                          {p.full_name || "Unnamed"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Category</Label>
                  <Select value={kudosCat} onValueChange={setKudosCat}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="great_work">🌟 Great Work</SelectItem>
                      <SelectItem value="team_player">🤝 Team Player</SelectItem>
                      <SelectItem value="innovation">💡 Innovation</SelectItem>
                      <SelectItem value="leadership">👑 Leadership</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Textarea placeholder="Say something nice..." value={kudosMsg} onChange={(e) => setKudosMsg(e.target.value)} className="min-h-[80px]" />
                <Button onClick={submitKudos} className="w-full" disabled={!kudosTo}>Send Kudos 🎉</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

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
