import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PAGE_KEYS, PAGE_LABELS, type PageKey } from "@/hooks/usePageAccess";
import { ChevronDown, ChevronRight, Lock, Loader2 } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

const sb = supabase as any;

interface Props {
  targetUserId: string;
  isPrimary: boolean;
  isAdmin: boolean;
}

export function UserAccessGrants({ targetUserId, isPrimary, isAdmin }: Props) {
  const { user: actingUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [grants, setGrants] = useState<Set<PageKey>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [savingKey, setSavingKey] = useState<PageKey | null>(null);

  useEffect(() => {
    if (!open || loaded) return;
    (async () => {
      const { data } = await sb.from("page_grants").select("page_key").eq("user_id", targetUserId);
      setGrants(new Set((data ?? []).map((r: any) => r.page_key as PageKey)));
      setLoaded(true);
    })();
  }, [open, loaded, targetUserId]);

  const toggle = async (key: PageKey, next: boolean) => {
    setSavingKey(key);
    if (next) {
      const { error } = await sb.from("page_grants").insert({
        user_id: targetUserId,
        page_key: key,
        granted_by: actingUser?.id || null,
      });
      if (error) {
        toast({ title: "Grant failed", description: error.message, variant: "destructive" });
      } else {
        setGrants((prev) => new Set([...prev, key]));
      }
    } else {
      const { error } = await sb.from("page_grants").delete().eq("user_id", targetUserId).eq("page_key", key);
      if (error) {
        toast({ title: "Revoke failed", description: error.message, variant: "destructive" });
      } else {
        setGrants((prev) => {
          const n = new Set(prev);
          n.delete(key);
          return n;
        });
      }
    }
    setSavingKey(null);
  };

  // Admins implicitly have access to everything — no need to grant individually
  const implicit = isAdmin || isPrimary;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="pt-2 border-t border-border/40">
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Lock className="h-3 w-3" />
        Page access
        {!implicit && grants.size > 0 && <span className="text-primary">({grants.size})</span>}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        {implicit ? (
          <p className="text-xs text-muted-foreground italic">Admins have access to every page.</p>
        ) : !loaded ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</div>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {PAGE_KEYS.map((key) => (
              <div key={key} className="flex items-center justify-between gap-2">
                <span className="text-xs text-foreground">{PAGE_LABELS[key]}</span>
                <Switch
                  checked={grants.has(key)}
                  onCheckedChange={(v) => toggle(key, v)}
                  disabled={savingKey === key}
                />
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
