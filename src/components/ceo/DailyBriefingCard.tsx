import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { RefreshCw, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const sb = supabase as any;

type Briefing = {
  bullets: string[];
  focus: string;
  generated_at: string | null;
};

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "Generated just now";
  if (min < 60) return `Generated ${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `Generated ${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  return `Generated ${day} day${day === 1 ? "" : "s"} ago`;
}

export function DailyBriefingCard() {
  const { user, profile } = useAuth() as any;
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);

  const today = new Date().toISOString().split("T")[0];

  const firstName = (() => {
    const full =
      profile?.full_name || user?.user_metadata?.full_name || user?.email || "";
    return (full.split(" ")[0] || "there").trim();
  })();

  const generate = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("daily-briefing");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setBriefing({
        bullets: data?.bullets ?? [],
        focus: data?.focus ?? "",
        generated_at: data?.generated_at ?? new Date().toISOString(),
      });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Could not generate briefing",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load cached briefing on mount; auto-generate if none for today
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await sb
        .from("daily_briefings")
        .select("bullets, focus, generated_at")
        .eq("user_id", user.id)
        .eq("briefing_date", today)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setBriefing({
          bullets: Array.isArray(data.bullets) ? data.bullets : [],
          focus: data.focus ?? "",
          generated_at: data.generated_at,
        });
        setFirstLoad(false);
      } else {
        setFirstLoad(false);
        generate();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, today, generate]);

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 p-6 elevation-2 relative">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Good morning, {firstName}.
          </h2>
          <p className="text-xs text-muted-foreground/80 mt-0.5">
            {formatDate(new Date())}
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={generate}
          disabled={loading}
          className="h-8 w-8 shrink-0"
          aria-label="Refresh briefing"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {firstLoad || (loading && !briefing) ? (
        <div className="space-y-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-3.5 rounded-full bg-muted/60 animate-pulse"
              style={{ width: `${85 - i * 8}%` }}
            />
          ))}
        </div>
      ) : briefing && (briefing.bullets.length > 0 || briefing.focus) ? (
        <div className="space-y-3">
          <ul className="space-y-2.5">
            {briefing.bullets.map((b, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-foreground/90 leading-relaxed">
                <span className="text-primary/70 mt-1.5 shrink-0">→</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          {briefing.focus && (
            <div className="mt-4 pl-3 border-l-2 border-emerald-500/70 py-1">
              <p className="text-[15px] font-semibold text-foreground leading-snug">
                {briefing.focus}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground italic flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" />
          No briefing yet — click refresh to generate one.
        </div>
      )}

      {briefing?.generated_at && !loading && (
        <p className="text-[11px] text-muted-foreground/60 mt-4">
          {relativeTime(briefing.generated_at)}
        </p>
      )}
    </div>
  );
}
