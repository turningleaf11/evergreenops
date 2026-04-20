import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

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
  const [submitting, setSubmitting] = useState(false);

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
  };

  const submit = async () => {
    if (!user) return;
    if (!toUser) {
      toast.error("Select a teammate");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("kudos").insert({
        from_user_id: user.id,
        to_user_id: toUser,
        message: message.trim(),
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

              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Say something nice..."
                rows={3}
                className="resize-none border-border/30 text-sm"
              />
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
      </DialogContent>
    </Dialog>
  );
}
