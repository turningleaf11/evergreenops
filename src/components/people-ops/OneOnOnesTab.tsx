import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { format, parseISO, differenceInDays } from "date-fns";
import { Plus, ChevronDown, ChevronRight, AlertTriangle, X, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionItem {
  text: string;
  completed: boolean;
  due_date?: string | null;
}

interface OneOnOne {
  id: string;
  employee_id: string;
  conducted_by: string;
  meeting_date: string;
  notes: string | null;
  sentiment: string;
  action_items: ActionItem[];
  next_meeting_date: string | null;
  created_at: string;
}

interface Profile {
  user_id: string;
  full_name: string | null;
}

const SENTIMENTS = [
  { value: "great", label: "Great", color: "bg-emerald-500", text: "text-emerald-600" },
  { value: "good", label: "Good", color: "bg-teal-500", text: "text-teal-600" },
  { value: "neutral", label: "Neutral", color: "bg-gray-400", text: "text-gray-600" },
  { value: "concerned", label: "Concerned", color: "bg-amber-500", text: "text-amber-600" },
  { value: "critical", label: "Critical", color: "bg-red-500", text: "text-red-600" },
] as const;

function sentimentMeta(s: string) {
  return SENTIMENTS.find((x) => x.value === s) ?? SENTIMENTS[2];
}

export function OneOnOnesTab({ employeeId, profiles }: { employeeId: string; profiles: Profile[] }) {
  const { user } = useAuth();
  const [items, setItems] = useState<OneOnOne[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("one_on_ones")
      .select("*")
      .eq("employee_id", employeeId)
      .order("meeting_date", { ascending: false });
    setItems(((data as any) || []).map((r: any) => ({ ...r, action_items: r.action_items || [] })));
    setLoading(false);
  }, [employeeId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const profileName = (id: string) => profiles.find((p) => p.user_id === id)?.full_name || "Unknown";

  const toggleActionItem = async (oo: OneOnOne, idx: number) => {
    const updated = oo.action_items.map((it, i) => (i === idx ? { ...it, completed: !it.completed } : it));
    setItems((prev) => prev.map((p) => (p.id === oo.id ? { ...p, action_items: updated } : p)));
    await supabase.from("one_on_ones").update({ action_items: updated as any }).eq("id", oo.id);
  };

  const lastMeeting = items[0];
  const daysSince = lastMeeting ? differenceInDays(new Date(), parseISO(lastMeeting.meeting_date)) : null;
  const showAlert = daysSince !== null && daysSince > 30;

  return (
    <div className="space-y-4">
      {showAlert && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Last 1-on-1 was {daysSince} days ago</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">1-on-1 History</h4>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> New 1-on-1
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No 1-on-1s logged yet. Schedule one.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((oo) => {
            const sm = sentimentMeta(oo.sentiment);
            const isOpen = expanded === oo.id;
            const openCount = oo.action_items.filter((a) => !a.completed).length;
            return (
              <div key={oo.id} className="rounded-lg border bg-card overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : oo.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 text-left"
                >
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-sm font-medium w-24 shrink-0">{format(parseISO(oo.meeting_date), "MMM d, yyyy")}</span>
                  <span className={cn("h-2 w-2 rounded-full shrink-0", sm.color)} title={sm.label} />
                  <span className="text-xs text-muted-foreground w-32 shrink-0 truncate">{profileName(oo.conducted_by)}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{openCount}/{oo.action_items.length} open</span>
                  <span className="text-xs text-muted-foreground truncate flex-1">{oo.notes?.replace(/\n/g, " ").slice(0, 80) || "—"}</span>
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 pt-1 space-y-3 border-t">
                    {oo.notes && (
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
                        <p className="text-sm whitespace-pre-wrap">{oo.notes}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Action items</p>
                      {oo.action_items.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">None</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {oo.action_items.map((it, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <Checkbox checked={it.completed} onCheckedChange={() => toggleActionItem(oo, i)} className="mt-0.5" />
                              <span className={cn("flex-1", it.completed && "line-through text-muted-foreground")}>{it.text}</span>
                              {it.due_date && <span className="text-xs text-muted-foreground">{format(parseISO(it.due_date), "MMM d")}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {oo.next_meeting_date && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <CalendarIcon className="h-3 w-3" /> Next: {format(parseISO(oo.next_meeting_date), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <NewOneOnOneDialog
        open={creating}
        onOpenChange={setCreating}
        employeeId={employeeId}
        conductedBy={user?.id || ""}
        onSaved={fetchData}
      />
    </div>
  );
}

function NewOneOnOneDialog({
  open,
  onOpenChange,
  employeeId,
  conductedBy,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employeeId: string;
  conductedBy: string;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [sentiment, setSentiment] = useState<string>("good");
  const [notes, setNotes] = useState("");
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [nextDate, setNextDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(format(new Date(), "yyyy-MM-dd"));
      setSentiment("good");
      setNotes("");
      setActionItems([]);
      setNextDate("");
    }
  }, [open]);

  const addItem = () => setActionItems((p) => [...p, { text: "", completed: false, due_date: null }]);
  const updateItem = (i: number, patch: Partial<ActionItem>) =>
    setActionItems((p) => p.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const removeItem = (i: number) => setActionItems((p) => p.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!conductedBy) return;
    setSaving(true);
    const { error } = await supabase.from("one_on_ones").insert({
      employee_id: employeeId,
      conducted_by: conductedBy,
      meeting_date: date,
      sentiment,
      notes: notes || null,
      action_items: actionItems.filter((i) => i.text.trim()) as any,
      next_meeting_date: nextDate || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "1-on-1 logged" });
      onOpenChange(false);
      onSaved();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New 1-on-1</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Sentiment</label>
            <div className="flex flex-wrap gap-1.5">
              {SENTIMENTS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSentiment(s.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5",
                    sentiment === s.value ? "border-foreground/30 bg-muted" : "border-border bg-background hover:bg-muted/50",
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", s.color)} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} className="mt-1" placeholder="What did you discuss?" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-muted-foreground">Action items</label>
              <Button type="button" variant="ghost" size="sm" onClick={addItem} className="h-7 text-xs">
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              {actionItems.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder="Action item"
                    value={it.text}
                    onChange={(e) => updateItem(i, { text: e.target.value })}
                    className="h-8 text-sm flex-1"
                  />
                  <Input
                    type="date"
                    value={it.due_date || ""}
                    onChange={(e) => updateItem(i, { due_date: e.target.value || null })}
                    className="h-8 text-sm w-36"
                  />
                  <button onClick={() => removeItem(i)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {actionItems.length === 0 && <p className="text-xs text-muted-foreground italic">No action items yet.</p>}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Next meeting date</label>
            <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} className="h-9 mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
