import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Play, Square, Plus, Calendar, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, differenceInMinutes, parseISO } from "date-fns";

interface TimeEntry {
  id: string;
  clock_in: string;
  clock_out: string | null;
  is_manual: boolean;
  notes: string;
  break_minutes: number;
}

interface TimeOffRequest {
  id: string;
  start_date: string;
  end_date: string;
  type: string;
  status: string;
  notes: string;
  created_at: string;
}

export default function TimeClockPage() {
  const { user, isAdmin } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [timeOffOpen, setTimeOffOpen] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  // Manual entry form
  const [manualDate, setManualDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [manualIn, setManualIn] = useState("09:00");
  const [manualOut, setManualOut] = useState("17:00");
  const [manualNotes, setManualNotes] = useState("");
  const [manualBreak, setManualBreak] = useState("0");

  // Time off form
  const [toStartDate, setToStartDate] = useState("");
  const [toEndDate, setToEndDate] = useState("");
  const [toType, setToType] = useState("pto");
  const [toNotes, setToNotes] = useState("");

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [entriesRes, requestsRes] = await Promise.all([
      supabase.from("time_entries").select("*").eq("user_id", user.id).order("clock_in", { ascending: false }).limit(200),
      supabase.from("time_off_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    if (entriesRes.data) {
      setEntries(entriesRes.data as TimeEntry[]);
      const open = (entriesRes.data as TimeEntry[]).find(e => !e.clock_out);
      setActiveEntry(open || null);
    }
    if (requestsRes.data) setRequests(requestsRes.data as TimeOffRequest[]);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const punchIn = async () => {
    if (!user) return;
    const { error } = await supabase.from("time_entries").insert({ user_id: user.id, clock_in: new Date().toISOString() });
    if (error) { toast.error(error.message); return; }
    toast.success("Clocked in!");
    fetchData();
  };

  const punchOut = async () => {
    if (!activeEntry) return;
    const { error } = await supabase.from("time_entries").update({ clock_out: new Date().toISOString() }).eq("id", activeEntry.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Clocked out!");
    fetchData();
  };

  const addManualEntry = async () => {
    if (!user) return;
    const clockIn = new Date(`${manualDate}T${manualIn}`).toISOString();
    const clockOut = new Date(`${manualDate}T${manualOut}`).toISOString();
    const { error } = await supabase.from("time_entries").insert({
      user_id: user.id,
      clock_in: clockIn,
      clock_out: clockOut,
      is_manual: true,
      notes: manualNotes,
      break_minutes: parseInt(manualBreak) || 0,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Manual entry added");
    setManualOpen(false);
    setManualNotes("");
    fetchData();
  };

  const submitTimeOff = async () => {
    if (!user || !toStartDate || !toEndDate) return;
    const { error } = await supabase.from("time_off_requests").insert({
      user_id: user.id,
      start_date: toStartDate,
      end_date: toEndDate,
      type: toType,
      notes: toNotes,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Time-off request submitted");
    setTimeOffOpen(false);
    setToNotes("");
    fetchData();
  };

  // Weekly timesheet
  const now = new Date();
  const weekStart = startOfWeek(new Date(now.getFullYear(), now.getMonth(), now.getDate() + weekOffset * 7), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const getHoursForDay = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return entries
      .filter(e => e.clock_in.startsWith(dayStr) && e.clock_out)
      .reduce((sum, e) => {
        const mins = differenceInMinutes(parseISO(e.clock_out!), parseISO(e.clock_in)) - (e.break_minutes || 0);
        return sum + Math.max(0, mins);
      }, 0);
  };

  const weekTotal = weekDays.reduce((sum, d) => sum + getHoursForDay(d), 0);

  const statusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    denied: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Time Clock</h1>
          <p className="text-sm text-muted-foreground">Track your work hours and manage time off</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setManualOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Manual Entry
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTimeOffOpen(true)}>
            <Calendar className="h-3.5 w-3.5 mr-1" /> Time Off
          </Button>
        </div>
      </div>

      {/* Punch Clock */}
      <Card>
        <CardContent className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`h-14 w-14 rounded-full flex items-center justify-center ${activeEntry ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"}`}>
              <Clock className={`h-7 w-7 ${activeEntry ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="text-lg font-semibold">
                {activeEntry ? "Currently Clocked In" : "Not Clocked In"}
              </p>
              {activeEntry && (
                <p className="text-sm text-muted-foreground">
                  Since {format(parseISO(activeEntry.clock_in), "h:mm a")}
                </p>
              )}
            </div>
          </div>
          {activeEntry ? (
            <Button onClick={punchOut} variant="destructive" size="lg" className="gap-2">
              <Square className="h-4 w-4" /> Clock Out
            </Button>
          ) : (
            <Button onClick={punchIn} size="lg" className="gap-2">
              <Play className="h-4 w-4" /> Clock In
            </Button>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="timesheet">
        <TabsList>
          <TabsTrigger value="timesheet">Timesheet</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="timeoff">Time Off</TabsTrigger>
        </TabsList>

        <TabsContent value="timesheet" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Weekly Timesheet</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setWeekOffset(w => w - 1)}>←</Button>
                  <span className="text-sm text-muted-foreground">
                    {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setWeekOffset(w => w + 1)}>→</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2 mb-4">
                {weekDays.map(day => {
                  const mins = getHoursForDay(day);
                  const hrs = (mins / 60).toFixed(1);
                  const isToday = format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
                  return (
                    <div key={day.toISOString()} className={`text-center p-3 rounded-lg border ${isToday ? "border-primary bg-primary/5" : "border-border"}`}>
                      <p className="text-xs text-muted-foreground">{format(day, "EEE")}</p>
                      <p className="text-xs text-muted-foreground">{format(day, "M/d")}</p>
                      <p className={`text-lg font-semibold mt-1 ${mins > 0 ? "text-foreground" : "text-muted-foreground/30"}`}>{hrs}</p>
                      <p className="text-[10px] text-muted-foreground">hrs</p>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Weekly Total</p>
                  <p className="text-2xl font-semibold">{(weekTotal / 60).toFixed(1)} hrs</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {entries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No time entries yet</p>
              ) : (
                <div className="space-y-1">
                  {entries.slice(0, 50).map(e => {
                    const mins = e.clock_out ? differenceInMinutes(parseISO(e.clock_out), parseISO(e.clock_in)) - (e.break_minutes || 0) : null;
                    return (
                      <div key={e.id} className="flex items-center gap-3 py-2 px-2 rounded hover:bg-muted/50 text-sm">
                        <span className="text-muted-foreground w-20 shrink-0">{format(parseISO(e.clock_in), "MMM d")}</span>
                        <span className="w-28 shrink-0">{format(parseISO(e.clock_in), "h:mm a")}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="w-28 shrink-0">{e.clock_out ? format(parseISO(e.clock_out), "h:mm a") : "—"}</span>
                        <span className="flex-1 font-medium">{mins != null ? `${(Math.max(0, mins) / 60).toFixed(1)} hrs` : "Active"}</span>
                        <div className="flex items-center gap-1.5">
                          {e.is_manual && (
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <AlertCircle className="h-2.5 w-2.5" /> Manual
                            </Badge>
                          )}
                          {e.notes && (
                            <Badge variant="secondary" className="text-[10px] gap-1">
                              <FileText className="h-2.5 w-2.5" /> Note
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeoff" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {requests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No time-off requests</p>
              ) : (
                <div className="space-y-2">
                  {requests.map(r => (
                    <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded-lg border border-border">
                      <div>
                        <p className="text-sm font-medium capitalize">{r.type.replace(/_/g, " ")}</p>
                        <p className="text-xs text-muted-foreground">{r.start_date} → {r.end_date}</p>
                        {r.notes && <p className="text-xs text-muted-foreground mt-0.5">{r.notes}</p>}
                      </div>
                      <Badge className={statusColor[r.status] || ""}>{r.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Manual Entry Dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Manual Entry</DialogTitle></DialogHeader>
          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> This entry will be flagged as manually added
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Date</label>
              <Input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Clock In</label>
                <Input type="time" value={manualIn} onChange={e => setManualIn(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Clock Out</label>
                <Input type="time" value={manualOut} onChange={e => setManualOut(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Break (minutes)</label>
              <Input type="number" value={manualBreak} onChange={e => setManualBreak(e.target.value)} min="0" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <Textarea value={manualNotes} onChange={e => setManualNotes(e.target.value)} placeholder="Reason for manual entry..." className="min-h-[60px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>Cancel</Button>
            <Button onClick={addManualEntry}>Add Entry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Time Off Dialog */}
      <Dialog open={timeOffOpen} onOpenChange={setTimeOffOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Request Time Off</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <Select value={toType} onValueChange={setToType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pto">PTO</SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Start Date</label>
                <Input type="date" value={toStartDate} onChange={e => setToStartDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">End Date</label>
                <Input type="date" value={toEndDate} onChange={e => setToEndDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <Textarea value={toNotes} onChange={e => setToNotes(e.target.value)} placeholder="Optional notes..." className="min-h-[60px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTimeOffOpen(false)}>Cancel</Button>
            <Button onClick={submitTimeOff}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
