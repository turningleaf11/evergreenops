import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles } from "lucide-react";
import { TeamHealthWidget } from "@/components/ceo/TeamHealthWidget";
import { ThisWeeksMeetingWidget } from "@/components/ceo/ThisWeeksMeetingWidget";
import { CeoKpiCard } from "@/components/ceo/CeoKpiCard";

function mondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function ThisWeekTab() {
  const { user } = useAuth();
  const week = useMemo(() => mondayOf(new Date()), []);

  const [priorities, setPriorities] = useState({ top: "", second: "", third: "" });
  const [savingPri, setSavingPri] = useState(false);

  const loadPriorities = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("ceo_weekly_priorities")
      .select("top_priority, second_priority, third_priority")
      .eq("user_id", user.id)
      .eq("week_start_date", week)
      .maybeSingle();
    if (data) {
      setPriorities({
        top: data.top_priority || "",
        second: data.second_priority || "",
        third: data.third_priority || "",
      });
    }
  }, [user, week]);

  useEffect(() => { loadPriorities(); }, [loadPriorities]);

  const savePriorities = async (next: typeof priorities) => {
    if (!user) return;
    setSavingPri(true);
    await supabase.from("ceo_weekly_priorities").upsert({
      user_id: user.id,
      week_start_date: week,
      top_priority: next.top,
      second_priority: next.second,
      third_priority: next.third,
    }, { onConflict: "user_id,week_start_date" });
    setSavingPri(false);
  };

  return (
    <div className="space-y-6">
      {/* KPI Snapshot */}
      <CeoKpiCard />

      {/* Team Health */}
      <TeamHealthWidget />

      {/* This Week's Leadership Meeting */}
      <ThisWeeksMeetingWidget />

      {/* Weekly Priorities */}
      <div className="rounded-2xl border border-border/50 bg-card/80 p-6 elevation-1">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">This Week's Focus</h2>
          {savingPri && <span className="text-[10px] text-muted-foreground/70">Saving…</span>}
        </div>
        <div className="space-y-2 mt-4">
          {([
            { key: "top",    label: "1", placeholder: "Top priority for this week..." },
            { key: "second", label: "2", placeholder: "Second priority..." },
            { key: "third",  label: "3", placeholder: "Third priority..." },
          ] as const).map((row) => (
            <div key={row.key} className="flex items-center gap-3 group">
              <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                {row.label}
              </span>
              <input
                value={priorities[row.key]}
                onChange={(e) => setPriorities((p) => ({ ...p, [row.key]: e.target.value }))}
                onBlur={(e) => {
                  const next = { ...priorities, [row.key]: e.target.value };
                  savePriorities(next);
                }}
                placeholder={row.placeholder}
                className="flex-1 bg-transparent text-sm text-foreground border-none outline-none placeholder:text-muted-foreground/40 py-1.5 border-b border-transparent focus:border-border/60 transition-colors"
              />
            </div>
          ))}
        </div>
        <p className="text-[11px] italic text-muted-foreground/70 mt-4">Resets each Monday</p>
      </div>
    </div>
  );
}
