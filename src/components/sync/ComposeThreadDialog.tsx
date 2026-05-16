import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Send, Loader2, Hash, Users, User } from "lucide-react";
import { toast } from "sonner";
import { SyncChannel, SyncTag } from "@/hooks/useSync";
import { SyncTagBadge } from "./SyncTagBadge";
import { LinkedItemPicker, LinkedItemChip, type LinkedItem } from "./LinkedItemPicker";
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

const channelTypeIcon = (type: string) => {
  if (type === "direct") return User;
  if (type === "group") return Users;
  return Hash;
};

export function ComposeThreadDialog({ open, onOpenChange, channels, tags, defaultChannelId, onCreated }: Props) {
  const { user } = useAuth();
  const [channelId, setChannelId] = useState<string>("");
  const [channelPickerOpen, setChannelPickerOpen] = useState(false);
  const [tagKey, setTagKey] = useState<string>("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linked, setLinked] = useState<LinkedItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChannelId(defaultChannelId || channels[0]?.id || "");
    setTagKey("");
    setTitle("");
    setBody("");
    setLinked([]);
  }, [open, defaultChannelId, channels]);

  const channel = channels.find((c) => c.id === channelId);
  const ChannelIcon = channel ? channelTypeIcon(channel.type) : Hash;

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
      linked_items: linked,
    }).select().single();
    setSubmitting(false);
    if (error || !data) {
      toast.error(error?.message || "Couldn't start thread");
      return;
    }
    try {
      const ch = channels.find((c) => c.id === channelId);
      const recipients = (ch?.members ?? []).map((m) => m.user_id).filter((uid) => uid && uid !== user.id);
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
    toast.success("Posted");
    onOpenChange(false);
    onCreated(data.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden">
        {/* Header strip — channel picker (looks like "Posting in: …") */}
        <div className="px-4 py-2.5 border-b border-border/40 bg-card/40 flex items-center justify-between gap-2">
          <div className="relative">
            <button
              onClick={() => setChannelPickerOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-foreground hover:bg-muted px-2 py-1 rounded-md"
            >
              <ChannelIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Posting in</span>
              <span className="text-primary">{channel?.displayName || "—"}</span>
              <span className="text-muted-foreground/60">▾</span>
            </button>
            {channelPickerOpen && (
              <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-lg border border-border bg-popover shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                {channels.map((c) => {
                  const Icon = channelTypeIcon(c.type);
                  const active = c.id === channelId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => { setChannelId(c.id); setChannelPickerOpen(false); }}
                      className={cn(
                        "w-full text-left px-3 py-2 flex items-center gap-2 text-xs hover:bg-accent/50",
                        active && "bg-accent",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{c.displayName}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground/60 capitalize">{c.type}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Body — feels like a post */}
        <div className="px-5 py-4 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's this about?"
            className="w-full text-lg font-semibold bg-transparent outline-none placeholder:text-muted-foreground/40"
            autoFocus
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add details… (optional)"
            className="w-full text-sm bg-transparent outline-none resize-none min-h-[140px] placeholder:text-muted-foreground/40 leading-relaxed"
          />

          {linked.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {linked.map((it) => (
                <LinkedItemChip
                  key={`${it.type}-${it.id}`}
                  item={it}
                  onRemove={() => setLinked((prev) => prev.filter((x) => !(x.type === it.type && x.id === it.id)))}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer — tags + link + send */}
        <div className="px-4 py-3 border-t border-border/40 bg-card/30 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
            {tags.map((t) => (
              <button
                key={t.key}
                onClick={() => setTagKey(tagKey === t.key ? "" : t.key)}
                className={cn(
                  "rounded-full transition-all",
                  tagKey === t.key ? "opacity-100 ring-2 ring-primary scale-105" : "opacity-60 hover:opacity-100",
                )}
                title={t.label}
              >
                <SyncTagBadge tag={t} size="xs" />
              </button>
            ))}
          </div>
          <LinkedItemPicker value={linked} onChange={setLinked} label="Link" />
          <button
            onClick={submit}
            disabled={submitting || !title.trim() || !channelId}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-primary-foreground disabled:opacity-40"
          >
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Post
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
