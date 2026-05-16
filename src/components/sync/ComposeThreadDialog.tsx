import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SyncChannel, SyncTag } from "@/hooks/useSync";
import { SyncTagBadge } from "./SyncTagBadge";
import { cn } from "@/lib/utils";

const sb = supabase as any;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channels: SyncChannel[];
  tags: SyncTag[];
  defaultChannelId?: string | null;
  onCreated: (threadId: string) => void;
}

export function ComposeThreadDialog({ open, onOpenChange, channels, tags, defaultChannelId, onCreated }: Props) {
  const { user } = useAuth();
  const [channelId, setChannelId] = useState<string>("");
  const [tagKey, setTagKey] = useState<string>("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChannelId(defaultChannelId || channels[0]?.id || "");
    setTagKey("");
    setTitle("");
    setBody("");
  }, [open, defaultChannelId, channels]);

  const submit = async () => {
    if (!user) return;
    if (!channelId) { toast.error("Pick a channel"); return; }
    if (!title.trim()) { toast.error("Add a title"); return; }
    setSubmitting(true);
    const { data, error } = await sb.from("sync_threads").insert({
      channel_id: channelId,
      title: title.trim(),
      body: body.trim(),
      author_id: user.id,
      tag: tagKey || null,
      status: "open",
    }).select().single();
    setSubmitting(false);
    if (error || !data) {
      toast.error(error?.message || "Couldn't start thread");
      return;
    }
    // Notify everyone else in the channel
    try {
      const channel = channels.find((c) => c.id === channelId);
      const recipients = (channel?.members ?? []).map((m) => m.user_id).filter((uid) => uid && uid !== user.id);
      if (recipients.length > 0) {
        const { data: actorProf } = await sb.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
        const actorName = (actorProf as any)?.full_name || "Someone";
        const tagLabel = tags.find((t) => t.key === tagKey)?.label;
        const labelPart = tagLabel ? ` [${tagLabel}]` : "";
        await sb.from("notifications").insert(recipients.map((uid: string) => ({
          user_id: uid,
          actor_id: user.id,
          actor_name: actorName,
          type: "sync_new_thread",
          entity_type: "sync_thread",
          entity_id: data.id,
          body: `started a new thread${labelPart}: "${title.trim()}"`,
          url: `/sync/thread/${data.id}`,
        })));
      }
    } catch (e) {
      console.warn("notify fan-out failed:", e);
    }
    toast.success("Thread started");
    onOpenChange(false);
    onCreated(data.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New thread</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Channel</label>
            <select
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="w-full text-sm bg-background border border-border rounded-md px-2.5 py-1.5"
            >
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.type === "direct" ? "Direct · " : c.type === "group" ? "Group · " : "Ad-hoc · "}{c.displayName}
                </option>
              ))}
            </select>
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title — what's this about?"
            className="w-full text-base font-medium bg-transparent border-b border-border pb-2 outline-none placeholder:text-muted-foreground/40"
            autoFocus
          />

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a short note… (optional)"
            className="w-full text-sm bg-transparent outline-none resize-none min-h-[100px] placeholder:text-muted-foreground/40"
          />

          <div className="space-y-1.5">
            <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Tag (optional)</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setTagKey("")}
                className={cn(
                  "px-2 py-1 rounded-full text-[11px] ring-1 transition-colors",
                  tagKey === "" ? "ring-primary bg-primary/10 text-foreground" : "ring-border/40 text-muted-foreground hover:text-foreground",
                )}
              >
                None
              </button>
              {tags.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTagKey(t.key)}
                  className={cn(
                    "rounded-full transition-opacity",
                    tagKey === t.key ? "opacity-100 ring-2 ring-primary" : "opacity-70 hover:opacity-100",
                  )}
                >
                  <SyncTagBadge tag={t} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => onOpenChange(false)} className="text-xs text-muted-foreground px-3 py-1.5">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting || !title.trim() || !channelId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground disabled:opacity-40"
            >
              {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Start thread
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
