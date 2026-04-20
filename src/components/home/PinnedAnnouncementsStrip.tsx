import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Pin, AlertTriangle, PartyPopper, Shield, Zap, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const typeStyles: Record<string, { icon: any; iconBg: string; iconColor: string; accent: string }> = {
  urgent:      { icon: AlertTriangle, iconBg: "bg-red-500/10",    iconColor: "text-red-600",    accent: "border-l-red-500" },
  celebration: { icon: PartyPopper,   iconBg: "bg-amber-500/10",  iconColor: "text-amber-600",  accent: "border-l-amber-500" },
  policy:      { icon: Shield,        iconBg: "bg-indigo-500/10", iconColor: "text-indigo-600", accent: "border-l-indigo-500" },
  update:      { icon: Zap,           iconBg: "bg-blue-500/10",   iconColor: "text-blue-600",   accent: "border-l-blue-500" },
  general:     { icon: Info,          iconBg: "bg-primary/10",    iconColor: "text-primary",    accent: "border-l-primary" },
};

export function PinnedAnnouncementsStrip() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    supabase
      .from("announcements")
      .select("id, title, content, type, created_at")
      .eq("pinned", true)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setItems(data || []));
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
      <div className="flex items-stretch overflow-x-auto scrollbar-thin">
        <div className="flex items-center gap-1.5 px-4 py-3 border-r border-border/40 bg-muted/30 shrink-0">
          <Pin className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pinned</span>
        </div>
        {items.map((a) => {
          const style = typeStyles[a.type] || typeStyles.general;
          const Icon = style.icon;
          return (
            <Link
              key={a.id}
              to="/feed"
              className={cn(
                "flex items-center gap-3 px-4 py-3 border-l-[3px] hover:bg-muted/40 transition-colors min-w-[280px] max-w-[420px] shrink-0",
                style.accent
              )}
            >
              <div className={cn("h-7 w-7 rounded-md flex items-center justify-center shrink-0", style.iconBg)}>
                <Icon className={cn("h-3.5 w-3.5", style.iconColor)} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{a.title}</p>
                {a.content && (
                  <p className="text-xs text-muted-foreground truncate">{a.content}</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
