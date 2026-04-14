import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlarmClock, Plus, Clock, AlertTriangle, CalendarIcon, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow, isPast, format, addDays } from "date-fns";
import { cn } from "@/lib/utils";

interface Reminder {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  completed: boolean;
  user_id: string;
  assigned_to: string | null;
  created_at: string;
}

export function RemindersWidget() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState<Date | undefined>();
  const [calOpen, setCalOpen] = useState(false);

  const fetchReminders = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("reminders")
      .select("*")
      .eq("completed", false)
      .order("due_at", { ascending: true, nullsFirst: false });
    if (data) setReminders(data as Reminder[]);
  }, [user]);

  useEffect(() => { fetchReminders(); }, [fetchReminders]);

  const toggleComplete = async (id: string) => {
    await supabase.from("reminders").update({ completed: true }).eq("id", id);
    setReminders(prev => prev.filter(r => r.id !== id));
    toast({ title: "Reminder completed ✓" });
  };

  const createReminder = async () => {
    if (!newTitle.trim() || !user) return;
    const { error } = await supabase.from("reminders").insert({
      title: newTitle.trim(),
      user_id: user.id,
      due_at: newDue ? newDue.toISOString() : null,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Reminder created" });
      setCreateOpen(false);
      setNewTitle("");
      setNewDue(undefined);
      fetchReminders();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && newTitle.trim()) {
      e.preventDefault();
      createReminder();
    }
  };

  const overdue = reminders.filter(r => r.due_at && isPast(new Date(r.due_at)));
  const upcoming = reminders.filter(r => {
    if (!r.due_at) return true;
    return !isPast(new Date(r.due_at));
  }).slice(0, 5);

  const display = [...overdue, ...upcoming].slice(0, 7);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlarmClock className="h-4 w-4" /> Reminders
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3 w-3 mr-1" /> New
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {display.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No pending reminders.</p>
        ) : (
          <div className="space-y-2">
            {display.map(r => {
              const isOverdue = r.due_at && isPast(new Date(r.due_at));
              return (
                <div key={r.id} className="flex items-start gap-2 group">
                  <Checkbox className="mt-0.5" onCheckedChange={() => toggleComplete(r.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    {r.due_at && (
                      <p className={`text-xs flex items-center gap-1 ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {isOverdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {isOverdue ? "Overdue" : ""} {formatDistanceToNow(new Date(r.due_at), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm gap-0 p-5">
          <DialogHeader className="pb-3">
            <DialogTitle className="text-base">New Reminder</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What do you need to remember?"
              className="border-0 px-0 text-base font-medium shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
              autoFocus
            />

            <div className="flex items-center gap-1.5">
              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
                    <CalendarIcon className="h-3 w-3" />
                    {newDue ? format(newDue, "MMM d") : "Due date"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="flex gap-1 p-2 border-b">
                    {[
                      { label: "Today", date: new Date() },
                      { label: "Tomorrow", date: addDays(new Date(), 1) },
                      { label: "Next week", date: addDays(new Date(), 7) },
                    ].map(q => (
                      <button
                        key={q.label}
                        onClick={() => { setNewDue(q.date); setCalOpen(false); }}
                        className="rounded-md px-2.5 py-1 text-xs hover:bg-muted transition-colors"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                  <Calendar
                    mode="single"
                    selected={newDue}
                    onSelect={(d) => { setNewDue(d); setCalOpen(false); }}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={createReminder} size="sm" className="h-8 px-4 text-xs" disabled={!newTitle.trim()}>
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function RemindersBell() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("reminders")
        .select("*")
        .eq("completed", false)
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(8);
      if (data) {
        setReminders(data as Reminder[]);
        const overdueCount = data.filter((r: any) => r.due_at && isPast(new Date(r.due_at))).length;
        setCount(overdueCount);
      }
    };
    fetch();
    const interval = setInterval(fetch, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const toggleComplete = async (id: string) => {
    await supabase.from("reminders").update({ completed: true }).eq("id", id);
    setReminders(prev => prev.filter(r => r.id !== id));
    setCount(prev => Math.max(0, prev - 1));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-md hover:bg-muted transition-colors"
      >
        <AlarmClock className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border bg-popover shadow-lg z-50 p-3">
          <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Reminders</p>
          {reminders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No pending reminders.</p>
          ) : (
            <div className="space-y-2">
              {reminders.map(r => {
                const isOverdue = r.due_at && isPast(new Date(r.due_at));
                return (
                  <div key={r.id} className="flex items-start gap-2 p-1.5 rounded hover:bg-muted transition-colors">
                    <Checkbox className="mt-0.5" onCheckedChange={() => toggleComplete(r.id)} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{r.title}</p>
                      {r.due_at && (
                        <p className={`text-[10px] ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                          {formatDistanceToNow(new Date(r.due_at), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
