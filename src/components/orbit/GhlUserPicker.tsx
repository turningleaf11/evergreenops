import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, Link2, Unlink, ExternalLink, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface GhlUser {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
}

interface Props {
  currentGhlUserId: string | null;
  onChange: (ghlUserId: string | null) => void;
  /** Inline display variant used inside the member detail drawer. */
  compact?: boolean;
}

/**
 * GHL user picker — fetches GHL users via the ghl-list-users edge function and
 * lets the admin pick a match for the current Orbit member.
 */
export function GhlUserPicker({ currentGhlUserId, onChange, compact = true }: Props) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<GhlUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const linked = currentGhlUserId ? users.find((u) => u.id === currentGhlUserId) : null;

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("ghl-list-users");
      if (invokeError) throw invokeError;
      if (data?.error) {
        setError(data.error);
        setUsers([]);
      } else {
        setUsers((data?.users ?? []) as GhlUser[]);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setUsers([]);
    }
    setLoading(false);
  };

  // Lazy-load when picker opens
  useEffect(() => {
    if (open && users.length === 0) {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Also fetch once on mount so we can resolve currentGhlUserId → name display
  useEffect(() => {
    if (currentGhlUserId && users.length === 0) {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGhlUserId]);

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return u.name.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s);
  });

  const pick = (ghlUserId: string) => {
    onChange(ghlUserId);
    setOpen(false);
    setSearch("");
    toast.success("Linked to GHL user");
  };

  const unlink = () => {
    onChange(null);
    setOpen(false);
    toast.success("GHL link removed");
  };

  return (
    <>
      {compact ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border/40 bg-card/60 hover:bg-muted/40 hover:border-border transition-colors text-left text-xs"
        >
          <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
          {linked ? (
            <>
              <span className="font-medium text-foreground truncate">{linked.name}</span>
              {linked.email && <span className="text-muted-foreground/60 truncate">· {linked.email}</span>}
            </>
          ) : currentGhlUserId && !loading ? (
            <span className="text-muted-foreground italic">Linked ({currentGhlUserId.slice(0, 8)}…)</span>
          ) : (
            <span className="text-muted-foreground">Not linked to GHL</span>
          )}
          <ExternalLink className="h-3 w-3 text-muted-foreground/40 ml-auto shrink-0" />
        </button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
          <Link2 className="h-3.5 w-3.5" /> {linked ? "Change GHL link" : "Link to GHL user"}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4" /> Link to GHL user
            </DialogTitle>
          </DialogHeader>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-medium text-destructive">Couldn't load GHL users</p>
                <p className="text-muted-foreground mt-0.5">{error}</p>
                <p className="text-muted-foreground/70 mt-1">Check that GHL_API_KEY and GHL_LOCATION_ID are set in Settings → Credentials.</p>
              </div>
            </div>
          )}

          {!error && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={loading ? "Loading…" : "Search GHL users by name or email…"}
                  className="pl-8 h-9"
                  autoFocus
                  disabled={loading}
                />
              </div>

              <div className="max-h-72 overflow-y-auto rounded-md border border-border/40 p-1">
                {loading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading GHL users…
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 text-center py-6 italic">
                    {search ? `No matches for "${search}"` : "No GHL users found"}
                  </p>
                ) : (
                  filtered.map((u) => {
                    const isSelected = u.id === currentGhlUserId;
                    return (
                      <button
                        key={u.id}
                        onClick={() => pick(u.id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-2 rounded-md text-left transition-colors",
                          isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/60"
                        )}
                      >
                        <Link2 className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "text-primary" : "text-muted-foreground/40")} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{u.name}</p>
                          {u.email && <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>}
                        </div>
                        {u.role && <span className="text-[10px] text-muted-foreground/60 shrink-0">{u.role}</span>}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {currentGhlUserId && (
              <Button variant="ghost" size="sm" onClick={unlink} className="text-destructive hover:text-destructive gap-1.5 mr-auto">
                <Unlink className="h-3 w-3" /> Unlink
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
