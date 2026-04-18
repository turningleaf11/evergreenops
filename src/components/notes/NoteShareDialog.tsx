import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Globe, Users, Check, X } from "lucide-react";

interface Member { user_id: string; full_name: string | null; email: string | null; avatar_url: string | null; }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  noteId: string;
  initialIsPublic: boolean;
  initialShareToken: string | null;
  initialSharedMemberIds: string[];
  onUpdated: (next: { is_public: boolean; share_token: string | null; shared_with: { memberIds: string[] } }) => void;
}

function genToken() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

export function NoteShareDialog({ open, onOpenChange, noteId, initialIsPublic, initialShareToken, initialSharedMemberIds, onUpdated }: Props) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [token, setToken] = useState(initialShareToken);
  const [memberIds, setMemberIds] = useState<string[]>(initialSharedMemberIds);
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIsPublic(initialIsPublic);
    setToken(initialShareToken);
    setMemberIds(initialSharedMemberIds);
  }, [noteId, initialIsPublic, initialShareToken, initialSharedMemberIds, open]);

  useEffect(() => {
    if (!open) return;
    supabase.from("profiles").select("user_id, full_name, email, avatar_url").then(({ data }) => {
      if (data) setMembers(data as Member[]);
    });
  }, [open]);

  const persist = async (updates: { is_public?: boolean; share_token?: string | null; shared_with?: { memberIds: string[] } }) => {
    setSaving(true);
    const { error } = await supabase.from("notes").update(updates).eq("id", noteId);
    setSaving(false);
    if (error) { toast.error(error.message); return false; }
    return true;
  };

  const togglePublic = async (next: boolean) => {
    let nextToken = token;
    if (next && !nextToken) nextToken = genToken();
    const ok = await persist({ is_public: next, share_token: nextToken });
    if (ok) {
      setIsPublic(next);
      setToken(nextToken);
      onUpdated({ is_public: next, share_token: nextToken, shared_with: { memberIds } });
    }
  };

  const toggleMember = async (uid: string) => {
    const next = memberIds.includes(uid) ? memberIds.filter(m => m !== uid) : [...memberIds, uid];
    const ok = await persist({ shared_with: { memberIds: next } });
    if (ok) {
      setMemberIds(next);
      onUpdated({ is_public: isPublic, share_token: token, shared_with: { memberIds: next } });
    }
  };

  const publicUrl = token ? `${window.location.origin}/n/${token}` : "";

  const copy = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    toast.success("Link copied");
  };

  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    return !q || m.full_name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share note</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Public link */}
          <div className="rounded-lg border border-border/50 p-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Globe className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Anyone with the link</Label>
                  <p className="text-xs text-muted-foreground">Read-only public access</p>
                </div>
              </div>
              <Switch checked={isPublic} onCheckedChange={togglePublic} disabled={saving} />
            </div>
            {isPublic && publicUrl && (
              <div className="flex items-center gap-2">
                <Input readOnly value={publicUrl} className="text-xs h-8" />
                <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={copy}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Team members */}
          <div className="rounded-lg border border-border/50 p-3 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <Label className="text-sm font-medium">Share with teammates</Label>
                <p className="text-xs text-muted-foreground">{memberIds.length} {memberIds.length === 1 ? "person" : "people"}</p>
              </div>
            </div>
            <Input placeholder="Search teammates…" value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-xs" />
            <div className="max-h-56 overflow-auto space-y-0.5">
              {filtered.map(m => {
                const checked = memberIds.includes(m.user_id);
                return (
                  <button
                    key={m.user_id}
                    onClick={() => toggleMember(m.user_id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-left"
                  >
                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                      {(m.full_name || m.email || "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{m.full_name || m.email}</div>
                      {m.email && <div className="text-[10px] text-muted-foreground truncate">{m.email}</div>}
                    </div>
                    {checked ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                  </button>
                );
              })}
              {filtered.length === 0 && <div className="text-xs text-muted-foreground text-center py-3">No teammates found</div>}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
