import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { RefreshCw, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

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

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function isoInDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

async function safeSelect<T>(label: string, query: PromiseLike<{ data: T | null; error: any }>): Promise<T | null> {
  const { data, error } = await query;
  if (error) {
    console.warn(`[DailyBriefingCard] ${label} failed`, error.message ?? error);
    return null;
  }
  return data;
}

async function buildLocalBriefing(userId: string): Promise<Briefing> {
  const in3Days = isoInDays(3);
  const [tasks, reminders, issues, projects, goals] = await Promise.all([
    safeSelect<any[]>(
      "tasks",
      sb
        .from("tasks")
        .select("title, status, priority, due_date")
        .eq("assigned_to", userId)
        .neq("status", "done")
        .lte("due_date", in3Days)
        .order("due_date", { ascending: true })
        .limit(10),
    ),
    safeSelect<any[]>(
      "reminders",
      sb
        .from("reminders")
        .select("title, status, due_at, due_date, created_at")
        .neq("status", "done")
        .order("created_at", { ascending: true })
        .limit(10),
    ),
    safeSelect<any[]>(
      "issues",
      sb
        .from("issues")
        .select("title, priority, status")
        .neq("status", "resolved")
        .order("priority", { ascending: true })
        .limit(10),
    ),
    safeSelect<any[]>(
      "projects",
      sb
        .from("projects")
        .select("title, status, updated_at")
        .neq("status", "done")
        .order("updated_at", { ascending: true })
        .limit(10),
    ),
    safeSelect<any[]>(
      "goals",
      sb
        .from("goals")
        .select("title, progress, status, quarter, year")
        .neq("status", "done")
        .order("year", { ascending: false })
        .order("quarter", { ascending: true })
        .limit(10),
    ),
  ]);

  const bullets: string[] = [];
  const taskList = tasks ?? [];
  const reminderList = reminders ?? [];
  const issueList = issues ?? [];
  const projectList = projects ?? [];
  const goalList = goals ?? [];

  if (taskList.length) {
    bullets.push(`${taskList.length} assigned task${taskList.length === 1 ? " is" : "s are"} due soon; top item: ${taskList[0].title}.`);
  }
  if (reminderList.length) {
    bullets.push(`${reminderList.length} delegation/reminder item${reminderList.length === 1 ? " is" : "s are"} still open; oldest item: ${reminderList[0].title}.`);
  }
  if (issueList.length) {
    bullets.push(`${issueList.length} open issue${issueList.length === 1 ? " needs" : "s need"} attention; first visible item: ${issueList[0].title}.`);
  }
  if (goalList.length) {
    bullets.push(`${goalList.length} active goal${goalList.length === 1 ? " is" : "s are"} still in motion; most recent: ${goalList[0].title}.`);
  }
  if (projectList.length) {
    bullets.push(`Oldest active project update is ${projectList[0].title}; check whether it needs movement today.`);
  }
  if (!bullets.length) {
    bullets.push("No urgent assigned tasks, open reminders, issues, goals, or stale projects were found in the current workspace data.");
  }

  const focus = taskList[0]?.title
    ? `Focus today on moving "${taskList[0].title}" forward.`
    : issueList[0]?.title
      ? `Focus today on resolving "${issueList[0].title}".`
      : reminderList[0]?.title
        ? `Focus today on closing the loop on "${reminderList[0].title}".`
        : "Focus today on choosing the highest-leverage priority and making it visible.";

  return {
    bullets: bullets.slice(0, 6),
    focus,
    generated_at: new Date().toISOString(),
  };
}

export function DailyBriefingCard() {
  const { user, profile } = useAuth() as any;
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);

  const today = todayIso();

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
      if (data?.cache_error) console.warn("daily-briefing cache warning", data.cache_error);
      if (data?.ai_error) console.warn("daily-briefing AI warning", data.ai_error);

      setBriefing({
        bullets: data?.bullets ?? [],
        focus: data?.focus ?? "",
        generated_at: data?.generated_at ?? new Date().toISOString(),
      });
    } catch (e: any) {
      console.error(e);
      const fallback = await buildLocalBriefing(user.id);
      setBriefing(fallback);
      toast({
        title: "Using a basic briefing for now",
        description: "The AI briefing service did not respond, so I built one from your workspace data.",
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load cached briefing on mount; auto-generate if none for today.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await sb
        .from("daily_briefings")
        .select("bullets, focus, generated_at")
        .eq("user_id", user.id)
        .eq("briefing_date", today)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.warn("daily_briefings cache read failed", error.message ?? error);
        setFirstLoad(false);
        generate();
        return;
      }
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
    <div
      className="relative rounded-2xl border border-primary/20 p-7 elevation-3 overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--primary) / 0.04) 60%, hsl(var(--primary) / 0.08) 100%)",
      }}
    >
      {/* Soft accent glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full opacity-60"
        style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.18), transparent 70%)" }}
      />
      <div className="relative flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 mb-2 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">AI Daily Briefing</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Good morning, {firstName}.
          </h2>
          <p className="text-xs text-muted-foreground/80 mt-1">
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
            <div
              className="mt-4 pl-3 py-1 border-l-2"
              style={{ borderColor: "hsl(142 71% 45% / 0.7)" }}
            >
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
