import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ImageIcon, Send, Megaphone, BarChart3, Heart, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadFile } from "@/lib/file-upload";
import { GiphyPicker } from "@/components/feed/GiphyPicker";
import RichTextEditor from "@/components/RichTextEditor";
import { cn } from "@/lib/utils";

interface FeedComposerProps {
  onPost: () => void;
  people: { user_id: string; full_name: string | null }[];
  compact?: boolean;
  requestedMode?: PostMode;
  requestKey?: number;
}

export type PostMode = "post" | "announcement" | "poll" | "kudos";

const modes: { value: PostMode; label: string; icon?: React.ElementType; adminOnly?: boolean }[] = [
  { value: "post", label: "Post" },
  { value: "announcement", label: "Announcement", icon: Megaphone, adminOnly: true },
  { value: "poll", label: "Poll", icon: BarChart3, adminOnly: true },
  { value: "kudos", label: "Kudos", icon: Heart },
];

export function FeedComposer({ onPost, people, compact = false, requestedMode, requestKey }: FeedComposerProps) {
  const { user, profile, isAdmin } = useAuth();
  const [mode, setMode] = useState<PostMode>("post");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [gifUrl, setGifUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const [annTitle, setAnnTitle] = useState("");
  const [annType, setAnnType] = useState("general");
  const [annPinned, setAnnPinned] = useState(false);

  const [pollTitle, setPollTitle] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  const [kudosTo, setKudosTo] = useState("");
  const [kudosCat, setKudosCat] = useState("great_work");

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!requestKey || !requestedMode) return;
    setMode(requestedMode);
    setExpanded(true);
  }, [requestKey, requestedMode]);

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
  const visibleModes = modes.filter((m) => !m.adminOnly || isAdmin);

  const placeholders: Record<PostMode, string> = {
    post: "What's on your mind?",
    announcement: "Add details...",
    poll: "Add context (optional)...",
    kudos: "Say something nice...",
  };

  return (
    <div className="rounded-2xl bg-card elevation-2 border border-border/40 overflow-hidden">
      <div className="p-5">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10 shrink-0 ring-2 ring-primary/10">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">{initials}</AvatarFallback>
          </Avatar>

          {!expanded ? (
            <button
              onClick={() => setExpanded(true)}
              className="w-full text-left py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              What's on your mind?
            </button>
          ) : (
            <div className="flex-1 min-w-0">
              {/* Mode tabs */}
              <div className="flex gap-1 mb-3">
                {visibleModes.map((m) => {
                  const Icon = m.icon;
                  const isActive = mode === m.value;
                  return (
                    <button
                      key={m.value}
                      onClick={() => setMode(m.value)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                        isActive
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      {Icon && <Icon className="h-3.5 w-3.5" />}
                      {m.label}
                    </button>
                  );
                })}
              </div>

              {/* Announcement fields — naked inputs */}
              {mode === "announcement" && (
                <div className="space-y-1 mb-2">
                  <input
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    placeholder="Announcement title"
                    className="w-full bg-transparent border-0 border-b border-border/30 rounded-none px-0 py-2 text-lg font-semibold placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 transition-colors duration-200"
                  />
                  <div className="flex gap-3 items-center pt-1">
                    <Select value={annType} onValueChange={setAnnType}>
                      <SelectTrigger className="w-36 h-7 text-xs border-border/30 bg-transparent"><SelectValue /></SelectTrigger>
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

              {/* Poll fields — underline style */}
              {mode === "poll" && (
                <div className="space-y-1 mb-2">
                  <input
                    value={pollTitle}
                    onChange={(e) => setPollTitle(e.target.value)}
                    placeholder="Poll question"
                    className="w-full bg-transparent border-0 border-b border-border/30 rounded-none px-0 py-2 text-lg font-semibold placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 transition-colors duration-200"
                  />
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground/50 w-4">{i + 1}.</span>
                      <input
                        placeholder={`Option ${i + 1}`}
                        value={opt}
                        onChange={(e) => { const n = [...pollOptions]; n[i] = e.target.value; setPollOptions(n); }}
                        className="flex-1 bg-transparent border-0 border-b border-border/30 rounded-none px-0 py-1.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 transition-colors duration-200"
                      />
                      {pollOptions.length > 2 && (
                        <button className="text-muted-foreground/40 hover:text-destructive transition-colors" onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}>
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => setPollOptions([...pollOptions, ""])}
                    className="text-xs text-primary/70 hover:text-primary font-medium transition-colors duration-200 pt-1"
                  >
                    + Add option
                  </button>
                </div>
              )}

              {/* Kudos selectors — reduced chrome */}
              {mode === "kudos" && (
                <div className="flex gap-2 mb-2">
                  <Select value={kudosTo} onValueChange={setKudosTo}>
                    <SelectTrigger className="h-8 text-xs flex-1 border-border/30 bg-transparent"><SelectValue placeholder="Give kudos to..." /></SelectTrigger>
                    <SelectContent>
                      {people.map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Unnamed"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={kudosCat} onValueChange={setKudosCat}>
                    <SelectTrigger className="h-8 text-xs w-36 border-border/30 bg-transparent"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="great_work">🌟 Great Work</SelectItem>
                      <SelectItem value="team_player">🤝 Team Player</SelectItem>
                      <SelectItem value="innovation">💡 Innovation</SelectItem>
                      <SelectItem value="leadership">👑 Leadership</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Main editor — supports @mentions across people, docs, notes, tasks, projects, goals, lists */}
              <div className={cn(compact && "-ml-1")}>
                <RichTextEditor
                  content={content}
                  onChange={setContent}
                  placeholder={placeholders[mode]}
                  borderless
                  compact={compact}
                />
              </div>

              {/* Media previews */}
              {imageUrl && (
                <div className="relative mb-2">
                  <img src={imageUrl} alt="Uploaded" className="rounded-xl max-h-48 object-cover" />
                  <button className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors" onClick={() => setImageUrl(null)}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {gifUrl && (
                <div className="relative mb-2">
                  <img src={gifUrl} alt="GIF" className="rounded-xl max-h-48 object-cover" />
                  <button className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors" onClick={() => setGifUrl("")}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Action bar — thin divider */}
              <div className="flex items-center justify-between pt-3 mt-1 border-t border-border/20">
                <div className="flex gap-0.5">
                  {mode === "post" && (
                    <>
                      <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground/60 hover:text-foreground rounded-lg" onClick={() => fileRef.current?.click()} disabled={uploading}>
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                        <span className="text-xs">Photo</span>
                      </Button>
                      <GiphyPicker onSelect={(url) => setGifUrl(url)}>
                        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground/60 hover:text-foreground rounded-lg">
                          <span className="text-xs font-semibold">GIF</span>
                        </Button>
                      </GiphyPicker>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground rounded-lg" onClick={reset}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 rounded-lg shadow-sm hover:shadow active:scale-[0.97] transition-all duration-200"
                    onClick={submit}
                    disabled={submitting}
                  >
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
