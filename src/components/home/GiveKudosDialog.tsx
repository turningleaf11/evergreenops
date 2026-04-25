import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, Loader2, Send, ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import RichTextEditor from "@/components/RichTextEditor";
import { GiphyPicker } from "@/components/feed/GiphyPicker";
import { uploadFile } from "@/lib/file-upload";

interface GiveKudosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
}

export function GiveKudosDialog({ open, onOpenChange, onSent }: GiveKudosDialogProps) {
  const { user, profile } = useAuth();
  const [people, setPeople] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [toUser, setToUser] = useState("");
  const [category, setCategory] = useState("great_work");
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [gifUrl, setGifUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    supabase.from("profiles").select("user_id, full_name").then(({ data }) => {
      if (data) setPeople(data.filter((p) => p.user_id !== user?.id));
    });
  }, [open, user?.id]);

  const reset = () => {
    setToUser("");
    setCategory("great_work");
    setMessage("");
    setImageUrl(null);
    setGifUrl("");
  };

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

  const submit = async () => {
    if (!user) return;
    if (!toUser) {
      toast.error("Select a teammate");
      return;
    }
    setSubmitting(true);
    try {
      // Embed media into the message HTML so existing kudos rendering picks it up,
      // since the kudos table has no dedicated media columns.
      let payload = message.trim();
      if (imageUrl) payload += `<p><img src="${imageUrl}" alt="" /></p>`;
      if (gifUrl) payload += `<p><img src="${gifUrl}" alt="GIF" /></p>`;

      const { error } = await supabase.from("kudos").insert({
        from_user_id: user.id,
        to_user_id: toUser,
        message: payload,
        category,
      });
      if (error) throw error;
      toast.success("Kudos sent! 🎉");
      reset();
      onOpenChange(false);
      onSent?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to send kudos");
    } finally {
      setSubmitting(false);
    }
  };

  const initials = (profile?.full_name || "U").split(" ").map((n) => n[0]).join("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40">
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="h-7 w-7 rounded-full bg-rose-500/10 flex items-center justify-center">
              <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500" />
            </div>
            Give Kudos
          </DialogTitle>
        </DialogHeader>

        <div className="p-5 space-y-3">
          <div className="flex gap-3">
            <Avatar className="h-10 w-10 shrink-0 ring-2 ring-primary/10">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex gap-2">
                <Select value={toUser} onValueChange={setToUser}>
                  <SelectTrigger className="h-8 text-xs flex-1 border-border/30 bg-transparent">
                    <SelectValue placeholder="Give kudos to..." />
                  </SelectTrigger>
                  <SelectContent>
                    {people.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {p.full_name || "Unnamed"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-8 text-xs w-36 border-border/30 bg-transparent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="great_work">🌟 Great Work</SelectItem>
                    <SelectItem value="team_player">🤝 Team Player</SelectItem>
                    <SelectItem value="innovation">💡 Innovation</SelectItem>
                    <SelectItem value="leadership">👑 Leadership</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <RichTextEditor
                content={message}
                onChange={setMessage}
                placeholder="Say something nice..."
                borderless
                compact
              />

              {imageUrl && (
                <div className="relative">
                  <img src={imageUrl} alt="Uploaded" className="rounded-xl max-h-40 object-cover" />
                  <button
                    className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                    onClick={() => setImageUrl(null)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {gifUrl && (
                <div className="relative">
                  <img src={gifUrl} alt="GIF" className="rounded-xl max-h-40 object-cover" />
                  <button
                    className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                    onClick={() => setGifUrl("")}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              <div className="flex gap-0.5 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-muted-foreground/70 hover:text-foreground rounded-lg"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                  <span className="text-xs">Photo</span>
                </Button>
                <GiphyPicker onSelect={(url) => setGifUrl(url)}>
                  <Button variant="ghost" size="sm" className="h-8 text-muted-foreground/70 hover:text-foreground rounded-lg">
                    <span className="text-xs font-semibold">GIF</span>
                  </Button>
                </GiphyPicker>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 bg-muted/30 border-t border-border/40 flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 rounded-lg shadow-sm"
            onClick={submit}
            disabled={submitting || !toUser}
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send Kudos
          </Button>
        </div>

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
      </DialogContent>
    </Dialog>
  );
}
