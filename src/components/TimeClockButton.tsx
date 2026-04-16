import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format, parseISO, differenceInMinutes } from "date-fns";

export function TimeClockButton() {
  const { user, profile } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [activeEntry, setActiveEntry] = useState<any>(null);
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("time_clock_enabled")
        .eq("user_id", user.id)
        .single();
      const isEnabled = p?.time_clock_enabled || false;
      setEnabled(isEnabled);
      if (isEnabled) {
        const { data: entries } = await supabase
          .from("time_entries")
          .select("*")
          .eq("user_id", user.id)
          .is("clock_out", null)
          .limit(1);
        if (entries && entries.length > 0) setActiveEntry(entries[0]);
      }
    };
    load();
  }, [user]);

  useEffect(() => {
    if (!activeEntry) { setElapsed(""); return; }
    const tick = () => {
      const mins = differenceInMinutes(new Date(), parseISO(activeEntry.clock_in));
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      setElapsed(`${h}h ${m}m`);
    };
    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, [activeEntry]);

  const punchIn = async () => {
    if (!user) return;
    const { error } = await supabase.from("time_entries").insert({ user_id: user.id, clock_in: new Date().toISOString() });
    if (error) { toast.error(error.message); return; }
    toast.success("Clocked in!");
    const { data } = await supabase.from("time_entries").select("*").eq("user_id", user.id).is("clock_out", null).limit(1);
    if (data && data.length > 0) setActiveEntry(data[0]);
  };

  const punchOut = async () => {
    if (!activeEntry) return;
    const { error } = await supabase.from("time_entries").update({ clock_out: new Date().toISOString() }).eq("id", activeEntry.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Clocked out!");
    setActiveEntry(null);
  };

  if (!enabled) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`relative h-9 w-9 rounded-xl ${
            !activeEntry
              ? "animate-pulse ring-2 ring-primary/20"
              : "ring-2 ring-green-500/30"
          }`}
        >
          {activeEntry ? (
            <Square className="h-4 w-4 text-green-500" />
          ) : (
            <Play className="h-4 w-4 text-primary" />
          )}
          {activeEntry && (
            <span className="absolute -top-1 -right-1 text-[9px] bg-green-500 text-white rounded-full px-1 font-medium leading-tight">
              {elapsed || "•"}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="end">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Time Clock</p>
          {activeEntry ? (
            <>
              <p className="text-sm font-semibold text-green-600">
                Clocked In — {elapsed}
              </p>
              <p className="text-xs text-muted-foreground">
                Since {format(parseISO(activeEntry.clock_in), "h:mm a")}
              </p>
              <Button size="sm" variant="destructive" className="w-full gap-1.5" onClick={punchOut}>
                <Square className="h-3 w-3" /> Clock Out
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">You're not clocked in.</p>
              <Button size="sm" className="w-full gap-1.5" onClick={punchIn}>
                <Play className="h-3 w-3" /> Clock In
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
