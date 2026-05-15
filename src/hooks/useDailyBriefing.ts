import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const sb = supabase as any;

export interface Briefing {
  id: string;
  bullets: string[];
  focus: string;
  generated_at: string;
  read_at: string | null;
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

/**
 * Loads today's briefing for the current user (cached row or generates on demand).
 * Exposes read state + a markRead() helper for use when the briefing is opened.
 */
export function useDailyBriefing() {
  const { user } = useAuth();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const today = todayIso();

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await sb
      .from("daily_briefings")
      .select("id, bullets, focus, generated_at, read_at")
      .eq("user_id", user.id)
      .eq("briefing_date", today)
      .maybeSingle();
    if (data) {
      setBriefing({
        id: data.id,
        bullets: Array.isArray(data.bullets) ? data.bullets : [],
        focus: data.focus ?? "",
        generated_at: data.generated_at,
        read_at: data.read_at,
      });
    } else {
      // Auto-generate if none for today
      try {
        const { data: gen } = await supabase.functions.invoke("daily-briefing");
        if (gen) {
          // Re-read to get the inserted row's id + read_at
          const { data: fresh } = await sb
            .from("daily_briefings")
            .select("id, bullets, focus, generated_at, read_at")
            .eq("user_id", user.id)
            .eq("briefing_date", today)
            .maybeSingle();
          if (fresh) {
            setBriefing({
              id: fresh.id,
              bullets: Array.isArray(fresh.bullets) ? fresh.bullets : [],
              focus: fresh.focus ?? "",
              generated_at: fresh.generated_at,
              read_at: fresh.read_at,
            });
          }
        }
      } catch (e) {
        console.error("briefing generate failed", e);
      }
    }
    setLoading(false);
  }, [user, today]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = useCallback(async () => {
    if (!briefing || briefing.read_at) return;
    const now = new Date().toISOString();
    setBriefing((b) => (b ? { ...b, read_at: now } : b));
    await sb.from("daily_briefings").update({ read_at: now }).eq("id", briefing.id);
  }, [briefing]);

  return { briefing, loading, markRead, refresh: load, unread: !!briefing && !briefing.read_at };
}
