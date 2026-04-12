import { useCEOContext } from "@/lib/ceo-context";
import { Sun } from "lucide-react";

export function MorningReset() {
  const { data, updateMorningReset } = useCEOContext();
  const { morningReset } = data;
  const today = new Date().toISOString().split("T")[0];
  const isToday = morningReset.date === today;

  return (
    <div className="space-y-4">
      {!isToday && (
        <p className="text-xs text-muted-foreground italic">Last reset: {morningReset.date || "never"}. Start fresh today.</p>
      )}

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
          <Sun className="h-3 w-3" /> What matters today
        </label>
        <textarea
          value={morningReset.whatMatters}
          onChange={(e) => updateMorningReset({ whatMatters: e.target.value })}
          placeholder="The one or two things that actually move the needle..."
          rows={2}
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 border-none outline-none resize-none"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
          What does NOT deserve attention
        </label>
        <textarea
          value={morningReset.whatToIgnore}
          onChange={(e) => updateMorningReset({ whatToIgnore: e.target.value })}
          placeholder="Things that feel urgent but aren't..."
          rows={2}
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 border-none outline-none resize-none"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
          One win for the day
        </label>
        <input
          value={morningReset.oneWin}
          onChange={(e) => updateMorningReset({ oneWin: e.target.value })}
          placeholder="If only one thing gets done, it's..."
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 border-none outline-none"
        />
      </div>
    </div>
  );
}
