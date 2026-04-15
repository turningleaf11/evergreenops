import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ImageIcon, Send, Megaphone, BarChart3, Heart, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadFile } from "@/lib/file-upload";
import { GiphyPicker } from "@/components/feed/GiphyPicker";

interface FeedComposerProps {
  onPost: () => void;
  people: { user_id: string; full_name: string | null }[];
}

type PostMode = "post" | "announcement" | "poll" | "kudos";

export function FeedComposer({ onPost, people }: FeedComposerProps) {
  const { user, profile, isAdmin } = useAuth();
  const [mode, setMode] = useState<PostMode>("post");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [gifUrl, setGifUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Announcement fields
  const [annTitle, setAnnTitle] = useState("");
  const [annType, setAnnType] = useState("general");
  const [annPinned, setAnnPinned] = useState(false);

  // Poll fields
  const [pollTitle, setPollTitle] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  // Kudos fields
  const [kudosTo, setKudosTo] = useState("");
  const [kudosCat, setKudosCat] = useState("great_work");

  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { toast.error("Image must be under 50MB"); return; }
    setUploading(true);
    const url = await uploadFile(file);
    if (url) setImageUrl(url);
    else toast.error("Upload failed");
    setUploading(false);
  };

  const reset = () => {
    setContent(""); setImageUrl(null); setGifUrl("");
    setAnnTitle(""); setAnnType("general"); setAnnPinned(false);
    setPollTitle(""); setPollOptions(["", ""]);
    setKudosTo(""); setKudosCat("great_work");
    setExpanded(false); setMode("post");
  };

  const submit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      if (mode === "post") {
        if (!content.trim() && !imageUrl && !gifUrl) { toast.error("Write something or add media"); setSubmitting(false); return; }
        await supabase.from("posts").insert({
          author_id: user.id,
          author_name: profile?.full_name || "Unknown",
          content: content.trim(),
          image_url: imageUrl,
          gif_url: gifUrl || null,
        });
        toast.success("Posted!");
      } else if (mode === "announcement") {
        if (!annTitle.trim()) { toast.error("Title required"); setSubmitting(false); return; }
        await supabase.from("announcements").insert({
          title: annTitle.trim(),
          content: content.trim(),
          type: annType,
          pinned: annPinned,
          author_id: user.id,
          author_name: profile?.full_name,
        });
        toast.success("Announcement posted");
      } else if (mode === "poll") {
        const validOpts = pollOptions.filter(Boolean);
        if (!pollTitle.trim() || validOpts.length < 2) { toast.error("Need a question and at least 2 options"); setSubmitting(false); return; }
        await supabase.from("polls").insert({
          title: pollTitle.trim(),
          description: content.trim(),
          options: validOpts,
          created_by: user.id,
        });
        toast.success("Poll created");
      } else if (mode === "kudos") {
        if (!kudosTo) { toast.error("Select a person"); setSubmitting(false); return; }
        await supabase.from("kudos").insert({
          from_user_id: user.id,
          to_user_id: kudosTo,
          message: content.trim(),
          category: kudosCat,
        });
        toast.success("Kudos sent! 🎉");
      }
      reset();
      onPost();
    } catch (e: any) {
      toast.error(e.message || "Failed to post");
    } finally {
      setSubmitting(false);
    }
  };

  const initials = (profile?.full_name || "U").split(" ").map((n) => n[0]).join("");

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground text-sm">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          {!expanded ? (
            <button
              onClick={() => setExpanded(true)}
              className="w-full text-left px-4 py-2.5 rounded-xl bg-muted/50 text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              What's on your mind?
            </button>
          ) : (
            <div className="space-y-3">
              {/* Mode selector */}
              <div className="flex gap-1 flex-wrap">
                <Badge
                  variant={mode === "post" ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => setMode("post")}
                >
                  Post
                </Badge>
                {isAdmin && (
                  <>
                    <Badge
                      variant={mode === "announcement" ? "default" : "outline"}
                      className="cursor-pointer text-xs gap-1"
                      onClick={() => setMode("announcement")}
                    >
                      <Megaphone className="h-3 w-3" /> Announcement
                    </Badge>
                    <Badge
                      variant={mode === "poll" ? "default" : "outline"}
                      className="cursor-pointer text-xs gap-1"
                      onClick={() => setMode("poll")}
                    >
                      <BarChart3 className="h-3 w-3" /> Poll
                    </Badge>
                  </>
                )}
                <Badge
                  variant={mode === "kudos" ? "default" : "outline"}
                  className="cursor-pointer text-xs gap-1"
                  onClick={() => setMode("kudos")}
                >
                  <Heart className="h-3 w-3" /> Kudos
                </Badge>
              </div>

              {/* Announcement-specific fields */}
              {mode === "announcement" && (
                <div className="space-y-2">
                  <Input placeholder="Announcement title" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} />
                  <div className="flex gap-2 items-center">
                    <Select value={annType} onValueChange={setAnnType}>
                      <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="urgent">🚨 Urgent</SelectItem>
                        <SelectItem value="celebration">🎉 Celebration</SelectItem>
                        <SelectItem value="update">🔄 Update</SelectItem>
                        <SelectItem value="policy">📋 Policy</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1.5">
                      <Switch checked={annPinned} onCheckedChange={setAnnPinned} className="scale-75" />
                      <span className="text-xs text-muted-foreground">Pin</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Poll-specific fields */}
              {mode === "poll" && (
                <div className="space-y-2">
                  <Input placeholder="Poll question" value={pollTitle} onChange={(e) => setPollTitle(e.target.value)} />
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex gap-1">
                      <Input
                        placeholder={`Option ${i + 1}`}
                        value={opt}
                        onChange={(e) => { const n = [...pollOptions]; n[i] = e.target.value; setPollOptions(n); }}
                        className="h-8 text-sm"
                      />
                      {pollOptions.length > 2 && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}>
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setPollOptions([...pollOptions, ""])}>+ Add option</Button>
                </div>
              )}

              {/* Kudos-specific fields */}
              {mode === "kudos" && (
                <div className="flex gap-2">
                  <Select value={kudosTo} onValueChange={setKudosTo}>
                    <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Give kudos to..." /></SelectTrigger>
                    <SelectContent>
                      {people.map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Unnamed"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={kudosCat} onValueChange={setKudosCat}>
                    <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="great_work">🌟 Great Work</SelectItem>
                      <SelectItem value="team_player">🤝 Team Player</SelectItem>
                      <SelectItem value="innovation">💡 Innovation</SelectItem>
                      <SelectItem value="leadership">👑 Leadership</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Content textarea */}
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={mode === "post" ? "What's on your mind?" : mode === "announcement" ? "Details..." : mode === "poll" ? "Description (optional)" : "Say something nice..."}
                className="min-h-[80px] resize-none text-sm"
              />

              {/* Image preview */}
              {imageUrl && (
                <div className="relative">
                  <img src={imageUrl} alt="Uploaded" className="rounded-lg max-h-48 object-cover" />
                  <Button size="icon" variant="secondary" className="absolute top-1 right-1 h-6 w-6" onClick={() => setImageUrl(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {/* GIF preview */}
              {gifUrl && (
                <div className="relative">
                  <img src={gifUrl} alt="GIF" className="rounded-lg max-h-48 object-cover" />
                  <Button size="icon" variant="secondary" className="absolute top-1 right-1 h-6 w-6" onClick={() => setGifUrl("")}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {/* Action bar */}
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {mode === "post" && (
                    <>
                      <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground" onClick={() => fileRef.current?.click()} disabled={uploading}>
                        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                        Photo
                      </Button>
                      <GiphyPicker onSelect={(url) => setGifUrl(url)}>
                        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground">
                          GIF
                        </Button>
                      </GiphyPicker>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={reset}>Cancel</Button>
                  <Button size="sm" className="h-8 gap-1.5" onClick={submit} disabled={submitting}>
                    {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Post
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
    </div>
  );
}
