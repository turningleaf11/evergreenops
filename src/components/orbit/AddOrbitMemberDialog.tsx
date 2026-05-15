import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { TRACK_OPTIONS, type OrbitTrack } from "./orbit-types";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

const sb = supabase as any;

interface Profile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  email?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  existingMemberUserIds: Set<string>;
  onAdded: () => void;
}

function initials(name: string | null) {
  return (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function AddOrbitMemberDialog({ open, onOpenChange, departmentId, existingMemberUserIds, onAdded }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [track, setTrack] = useState<OrbitTrack>("dts");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await sb
        .from("profiles")
        .select("user_id, full_name, avatar_url, email")
        .order("full_name", { ascending: true });
      setProfiles((data ?? []) as Profile[]);
    })();
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelectedId(null);
      setTrack("dts");
    }
  }, [open]);

  const filtered = profiles.filter((p) => {
    if (existingMemberUserIds.has(p.user_id)) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (p.full_name?.toLowerCase().includes(s) || p.email?.toLowerCase().includes(s));
  });

  const handleAdd = async () => {
    if (!selectedId) return;
    setSaving(true);
    const { error } = await sb.from("orbit_members").insert({
      user_id: selectedId,
      department_id: departmentId,
      track,
      status: "active",
    });
    setSaving(false);
    if (error) {
      toast.error("Failed to add member: " + error.message);
      return;
    }
    toast.success("Member added to Orbit");
    onAdded();
    onOpenChange(false);
  };

  const selectedProfile = profiles.find((p) => p.user_id === selectedId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Orbit Member</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team members…"
              className="pl-8 h-9"
              autoFocus
            />
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto space-y-1 border border-border/40 rounded-lg p-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 text-center py-6 italic">
                {search ? `No matches for "${search}"` : "No eligible team members."}
              </p>
            ) : (
              filtered.map((p) => {
                const isSelected = p.user_id === selectedId;
                return (
                  <button
                    key={p.user_id}
                    onClick={() => setSelectedId(p.user_id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
                      isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/60"
                    }`}
                  >
                    <Avatar className="h-7 w-7">
                      {p.avatar_url && <AvatarImage src={p.avatar_url} />}
                      <AvatarFallback className="text-[10px] bg-muted">{initials(p.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.full_name || "Unnamed"}</p>
                      {p.email && <p className="text-[10px] text-muted-foreground truncate">{p.email}</p>}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Track picker */}
          {selectedProfile && (
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Track</p>
              <Select value={track} onValueChange={(v) => setTrack(v as OrbitTrack)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRACK_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground/70">
                Each track is a 90-day commitment. You can change it later.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAdd} disabled={!selectedId || saving} className="gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Add to Orbit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
