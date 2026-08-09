import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Loader2, Check, X, RefreshCw, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type DraftDeliverable = {
  title: string;
  category: string;
  due_date: string | null;
  owner_user_id: string | null;
  rationale: string;
};

type ProfileRow = { user_id: string; full_name: string | null };

interface Props {
  planId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profiles: ProfileRow[];
  onAccepted: () => void;
}

export function AlbusDraftDeliverablesSheet({ planId, open, onOpenChange, profiles, onAccepted }: Props) {
  const [loading, setLoading] = useState(false);
  const [deliverables, setDeliverables] = useState<DraftDeliverable[] | null>(null);
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [generatedFor, setGeneratedFor] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setAccepted(new Set());
    setDismissed(new Set());
    const { data, error } = await supabase.functions.invoke("albus-draft-plan", { body: { businessPlanId: planId } });
    setLoading(false);
    if (error) { setError(error.message || "Couldn't draft deliverables"); return; }
    if (data?.error) { setError(data.error); return; }
    setDeliverables(data.deliverables || []);
    setGeneratedFor(planId);
  };

  // The parent opens this sheet by flipping its own `open` state (not via
  // Radix's onOpenChange, which only fires on user-driven close/escape) —
  // so the auto-generate-on-open trigger has to watch `open` itself.
  useEffect(() => {
    if (open && generatedFor !== planId && !loading) void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, planId]);

  const accept = async (i: number, d: DraftDeliverable) => {
    if (accepted.has(i)) return;
    const { error } = await supabase.from("business_plan_deliverables").insert({
      business_plan_id: planId,
      title: d.title,
      category: d.category || "General",
      due_date: d.due_date || null,
      owner_id: d.owner_user_id || null,
    } as any);
    if (error) { toast({ title: "Couldn't add deliverable", description: error.message, variant: "destructive" }); return; }
    setAccepted((s) => new Set(s).add(i));
    onAccepted();
  };

  const dismiss = (i: number) => setDismissed((s) => new Set(s).add(i));
  const isResolved = (i: number) => accepted.has(i) || dismissed.has(i);

  const acceptAll = async () => {
    if (!deliverables) return;
    for (let i = 0; i < deliverables.length; i++) {
      if (!isResolved(i)) await accept(i, deliverables[i]);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="space-y-1">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Albus · Draft Deliverables
          </SheetTitle>
          <p className="text-sm text-muted-foreground pt-1">
            Read from what's written in the Plan doc so far.
          </p>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading the plan doc and drafting deliverables…
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm space-y-2">
              <p className="font-medium text-destructive">Couldn't draft deliverables</p>
              <p className="text-muted-foreground text-xs">{error}</p>
              <button onClick={generate} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                <RefreshCw className="h-3 w-3" /> Try again
              </button>
            </div>
          )}

          {deliverables && !loading && !error && (
            <>
              {deliverables.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nothing to draft from yet — write a bit more in the Plan doc, then try again.
                </p>
              ) : (
                deliverables.map((d, i) => {
                  const owner = profiles.find((p) => p.user_id === d.owner_user_id);
                  return (
                    <div
                      key={i}
                      className={cn(
                        "rounded-lg border bg-card/40 p-3 space-y-2 transition-opacity",
                        isResolved(i) && "opacity-60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground">{d.title}</p>
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{d.category || "General"}</span>
                            {d.due_date && <span className="text-[10px] text-muted-foreground">{format(new Date(d.due_date), "MMM d")}</span>}
                            {owner && <span className="text-[10px] text-muted-foreground">→ {owner.full_name}</span>}
                            {accepted.has(i) && <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600"><Check className="h-3 w-3" /> Added</span>}
                            {dismissed.has(i) && <span className="text-[10px] text-muted-foreground/60">Dismissed</span>}
                          </div>
                          {d.rationale && <p className="text-[11px] text-muted-foreground/70 mt-1.5 italic">{d.rationale}</p>}
                        </div>
                      </div>
                      {!isResolved(i) && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <button onClick={() => accept(i, d)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20">
                            <Check className="h-3 w-3" /> Add deliverable
                          </button>
                          <button onClick={() => dismiss(i)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted">
                            <X className="h-3 w-3" /> Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {deliverables.length > 0 && (
                <div className="flex items-center justify-between gap-2 pt-4 border-t border-border/40 sticky bottom-0 bg-background py-3 -mx-6 px-6">
                  <button onClick={generate} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <RefreshCw className="h-3 w-3" /> Regenerate
                  </button>
                  <button onClick={acceptAll} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground">
                    <Send className="h-3 w-3" /> Accept all remaining
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
