import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const sb = supabase as any;

type Slot = 1 | 2 | 3;

export function TodaysPriorities() {
  const { user } = useAuth();
  const today = new Date().toISOString().split("T")[0];
  const [values, setValues] = useState<Record<Slot, string>>({ 1: "", 2: "", 3: "" });
  const [loaded, setLoaded] = useState(false);
  const saveTimers = useRef<Record<Slot, ReturnType<typeof setTimeout> | null>>({
    1: null, 2: null, 3: null,
  });

  // Load today's priorities
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await sb
        .from("daily_priorities")
        .select("slot, text")
        .eq("user_id", user.id)
        .eq("priority_date", today);
      if (cancelled) return;
      const next: Record<Slot, string> = { 1: "", 2: "", 3: "" };
      (data ?? []).forEach((r: any) => {
        if (r.slot >= 1 && r.slot <= 3) next[r.slot as Slot] = r.text || "";
      });
      setValues(next);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [user, today]);

  const persist = useCallback(async (slot: Slot, text: string) => {
    if (!user) return;
    await sb.from("daily_priorities").upsert(
      {
        user_id: user.id,
        priority_date: today,
        slot,
        text,
      },
      { onConflict: "user_id,priority_date,slot" },
    );
  }, [user, today]);

  const onChange = (slot: Slot, text: string) => {
    setValues((prev) => ({ ...prev, [slot]: text }));
    if (saveTimers.current[slot]) clearTimeout(saveTimers.current[slot]!);
    saveTimers.current[slot] = setTimeout(() => persist(slot, text), 500);
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-5 elevation-1">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Today's Priorities</h3>
        <p className="text-[11px] italic text-muted-foreground/70">
          Your input. Not AI-generated.
        </p>
      </div>
      <div className="space-y-2">
        {([1, 2, 3] as Slot[]).map((slot) => (
          <div key={slot} className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground/60 w-4 tabular-nums">
              {slot}.
            </span>
            <input
              value={values[slot]}
              onChange={(e) => onChange(slot, e.target.value)}
              placeholder="What are you committing to today?"
              disabled={!loaded}
              className={cn(
                "flex-1 bg-transparent text-sm text-foreground border-none outline-none",
                "placeholder:text-muted-foreground/40 py-1.5 px-0",
                "border-b border-transparent focus:border-border/50 transition-colors",
              )}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
