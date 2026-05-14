import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { MentionInput, type MentionRef } from "./MentionInput";

const sb = supabase as any;

type Slot = 1 | 2 | 3;

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function TodaysPriorities() {
  const { user } = useAuth();
  const today = localToday();
  const [values, setValues] = useState<Record<Slot, string>>({ 1: "", 2: "", 3: "" });
  const [mentionsBySlot, setMentionsBySlot] = useState<Record<Slot, MentionRef[]>>({ 1: [], 2: [], 3: [] });
  const [loaded, setLoaded] = useState(false);
  const saveTimers = useRef<Record<Slot, ReturnType<typeof setTimeout> | null>>({
    1: null, 2: null, 3: null,
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await sb
        .from("daily_priorities")
        .select("slot, text, mentions")
        .eq("user_id", user.id)
        .eq("priority_date", today);
      if (cancelled) return;
      if (error) console.error("Priority load failed:", error.message);
      const nextVals: Record<Slot, string> = { 1: "", 2: "", 3: "" };
      const nextMentions: Record<Slot, MentionRef[]> = { 1: [], 2: [], 3: [] };
      (data ?? []).forEach((r: any) => {
        if (r.slot >= 1 && r.slot <= 3) {
          nextVals[r.slot as Slot] = r.text || "";
          nextMentions[r.slot as Slot] = Array.isArray(r.mentions) ? r.mentions : [];
        }
      });
      setValues(nextVals);
      setMentionsBySlot(nextMentions);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [user, today]);

  const persist = useCallback(async (slot: Slot, text: string, mentions: MentionRef[]) => {
    if (!user) return;
    const { error } = await sb.from("daily_priorities").upsert(
      { user_id: user.id, priority_date: today, slot, text, mentions },
      { onConflict: "user_id,priority_date,slot" },
    );
    if (error) console.error("Priority save failed:", error.message);
  }, [user, today]);

  const onChange = (slot: Slot, text: string) => {
    setValues((prev) => ({ ...prev, [slot]: text }));
    const currentMentions = mentionsBySlot[slot];
    if (saveTimers.current[slot]) clearTimeout(saveTimers.current[slot]!);
    saveTimers.current[slot] = setTimeout(() => persist(slot, text, currentMentions), 500);
  };

  const onMentionsChange = (slot: Slot, mentions: MentionRef[]) => {
    setMentionsBySlot((prev) => ({ ...prev, [slot]: mentions }));
    const currentText = values[slot];
    if (saveTimers.current[slot]) clearTimeout(saveTimers.current[slot]!);
    saveTimers.current[slot] = setTimeout(() => persist(slot, currentText, mentions), 500);
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-5 elevation-1">
      <h3 className="text-sm font-semibold text-foreground mb-3">Priorities</h3>
      <div className="space-y-3">
        {([1, 2, 3] as Slot[]).map((slot) => (
          <div key={slot} className="flex items-center gap-3 border-b border-transparent focus-within:border-border/50 transition-colors pb-0.5">
            <span className="text-xs font-medium text-muted-foreground/60 w-4 tabular-nums shrink-0">
              {slot}.
            </span>
            <MentionInput
              value={values[slot]}
              onChange={(text) => onChange(slot, text)}
              mentions={mentionsBySlot[slot]}
              onMentionsChange={(m) => onMentionsChange(slot, m)}
              placeholder="What are you committing to today?"
              disabled={!loaded}
              inputClassName="text-sm text-foreground placeholder:text-muted-foreground/40 py-1"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
