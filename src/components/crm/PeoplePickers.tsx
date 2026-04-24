import { useEffect, useMemo, useState } from "react";
import { Loader2, UserCircle2, Plus, X, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";

interface Person {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

function usePeople() {
  const [people, setPeople] = useState<Person[]>([]);
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id,full_name,avatar_url")
        .order("full_name", { ascending: true })
        .limit(500);
      if (active) setPeople((data as Person[]) || []);
    })();
    return () => {
      active = false;
    };
  }, []);
  return people;
}

function Avatar({ person, size = 22 }: { person: Person | null; size?: number }) {
  if (!person) {
    return (
      <div
        className="rounded-full bg-muted text-muted-foreground flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <UserCircle2 className="w-3.5 h-3.5" />
      </div>
    );
  }
  if (person.avatar_url) {
    return (
      <img
        src={person.avatar_url}
        alt=""
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = (person.full_name || "?")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className="rounded-full bg-primary/15 text-primary text-[10px] font-semibold flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {initials || "?"}
    </div>
  );
}

export function OwnerPicker({
  ownerId,
  onChange,
  label = "Owner",
}: {
  ownerId: string | null;
  onChange: (id: string | null) => Promise<void> | void;
  label?: string;
}) {
  const people = usePeople();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const owner = useMemo(() => people.find((p) => p.user_id === ownerId) || null, [people, ownerId]);
  const filtered = q.trim()
    ? people.filter((p) => (p.full_name || "").toLowerCase().includes(q.toLowerCase()))
    : people;

  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="w-full flex items-center gap-2 text-sm rounded-md border border-input bg-background px-2 py-1.5 hover:bg-muted/50 transition-colors">
            <Avatar person={owner} />
            <span className="truncate text-left flex-1">
              {owner ? owner.full_name || "Unnamed" : <span className="text-muted-foreground">Unassigned</span>}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <div className="px-2 py-1.5 border-b border-border/40">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search people…"
                className="h-8 pl-7 text-sm"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-64 overflow-auto">
            <button
              onClick={async () => {
                await onChange(null);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
            >
              <Avatar person={null} />
              <span className="text-muted-foreground">Unassigned</span>
            </button>
            {filtered.map((p) => (
              <button
                key={p.user_id}
                onClick={async () => {
                  await onChange(p.user_id);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
              >
                <Avatar person={p} />
                <span className="truncate">{p.full_name || "Unnamed"}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface TeamMember {
  id: string;
  user_id: string;
}

export function DealTeamMembersPanel({
  dealId,
  canManage,
  currentUserId,
}: {
  dealId: string;
  canManage: boolean;
  currentUserId: string | null;
}) {
  const people = usePeople();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("deal_team_members")
      .select("id,user_id")
      .eq("deal_id", dealId);
    setMembers((data as TeamMember[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  const memberIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);

  const add = async (userId: string) => {
    const { error } = await supabase.from("deal_team_members").insert({
      deal_id: dealId,
      user_id: userId,
      added_by: currentUserId,
    });
    if (error) {
      toast({ title: "Couldn't add team member", description: error.message, variant: "destructive" });
      return;
    }
    setOpen(false);
    setQ("");
    await load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("deal_team_members").delete().eq("id", id);
    if (error) {
      toast({ title: "Couldn't remove", description: error.message, variant: "destructive" });
      return;
    }
    await load();
  };

  const candidates = people
    .filter((p) => !memberIds.has(p.user_id))
    .filter((p) => (q.trim() ? (p.full_name || "").toLowerCase().includes(q.toLowerCase()) : true));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Team members
        </div>
        {canManage && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0">
              <div className="px-2 py-1.5 border-b border-border/40">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search people…"
                    className="h-8 pl-7 text-sm"
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-60 overflow-auto">
                {candidates.length === 0 && (
                  <div className="py-3 text-center text-xs text-muted-foreground">
                    No people to add
                  </div>
                )}
                {candidates.map((p) => (
                  <button
                    key={p.user_id}
                    onClick={() => add(p.user_id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
                  >
                    <Avatar person={p} />
                    <span className="truncate">{p.full_name || "Unnamed"}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
        </div>
      ) : members.length === 0 ? (
        <p className="text-xs text-muted-foreground">No team members yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {members.map((m) => {
            const p = people.find((pp) => pp.user_id === m.user_id) || null;
            return (
              <div
                key={m.id}
                className="inline-flex items-center gap-1.5 pl-1 pr-1.5 py-0.5 rounded-full border border-border/50 bg-card text-xs"
              >
                <Avatar person={p} size={18} />
                <span className="truncate max-w-[140px]">
                  {p?.full_name || "Unknown"}
                </span>
                {canManage && (
                  <button
                    onClick={() => remove(m.id)}
                    className="text-muted-foreground hover:text-destructive p-0.5 rounded"
                    title="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
