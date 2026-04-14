import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bell, Plus, Clock, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Reminder {
  id: string;
  user_id: string;
  assigned_to: string | null;
  title: string;
  description: string;
  due_at: string | null;
  completed: boolean;
  created_at: string;
}

export default function RemindersPage() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  const fetchReminders = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("reminders")
      .select("*")
      .order("due_at", { ascending: true, nullsFirst: false });
    if (data) setReminders(data as Reminder[]);
  }, [user]);

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("user_id, full_name");
    if (data) setProfiles(data);
  }, []);

  useEffect(() => { fetchReminders(); fetchProfiles(); }, [fetchReminders, fetchProfiles]);

  const getName = (uid: string | null) => {
    if (!uid) return null;
    return profiles.find((p) => p.user_id === uid)?.full_name || "Unknown";
  };

  const createReminder = async () => {
    if (!title.trim() || !user) return;
    const { error } = await supabase.from("reminders").insert({
      title: title.trim(),
      description,
      due_at: dueAt || null,
      assigned_to: assignedTo || null,
      user_id: user.id,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Reminder created" });
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      setDueAt("");
      setAssignedTo("");
      fetchReminders();
    }
  };

  const toggleComplete = async (id: string, completed: boolean) => {
    await supabase.from("reminders").update({ completed }).eq("id", id);
    fetchReminders();
  };

  const now = new Date();
  const activeReminders = reminders.filter((r) => !r.completed);
  const completedReminders = reminders.filter((r) => r.completed);
  const overdueReminders = activeReminders.filter(
    (r) => r.due_at && new Date(r.due_at) < now
  );
  const upcomingReminders = activeReminders.filter(
    (r) => !r.due_at || new Date(r.due_at) >= now
  );

  const ReminderCard = ({ reminder }: { reminder: Reminder }) => {
    const isOverdue = reminder.due_at && new Date(reminder.due_at) < now && !reminder.completed;
    const delegated = reminder.assigned_to && reminder.assigned_to !== reminder.user_id;

    return (
      <Card className={`${isOverdue ? "border-destructive/50" : ""} ${reminder.completed ? "opacity-60" : ""}`}>
        <CardContent className="py-3 flex items-start gap-3">
          <Checkbox
            checked={reminder.completed}
            onCheckedChange={(checked) => toggleComplete(reminder.id, !!checked)}
            className="mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <span className={`text-sm font-medium ${reminder.completed ? "line-through" : ""}`}>
              {reminder.title}
            </span>
            {reminder.description && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{reminder.description}</p>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {reminder.due_at && (
                <Badge variant={isOverdue ? "destructive" : "outline"} className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {new Date(reminder.due_at).toLocaleDateString()} {new Date(reminder.due_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Badge>
              )}
              {delegated && (
                <Badge variant="secondary" className="text-xs">
                  <User className="h-3 w-3 mr-1" />
                  {getName(reminder.assigned_to)}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Reminders</h1>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Reminder</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Reminder</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Reminder title..." />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional..." />
              </div>
              <div>
                <Label>Due Date & Time</Label>
                <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
              </div>
              <div>
                <Label>Delegate To</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger><SelectValue placeholder="Assign to yourself (default)" /></SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Unknown"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={createReminder} className="w-full" disabled={!title.trim()}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {overdueReminders.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-destructive flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> Overdue ({overdueReminders.length})
          </h2>
          {overdueReminders.map((r) => <ReminderCard key={r.id} reminder={r} />)}
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Upcoming</h2>
        {upcomingReminders.map((r) => <ReminderCard key={r.id} reminder={r} />)}
        {upcomingReminders.length === 0 && overdueReminders.length === 0 && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No reminders yet. Create one to stay on track.</CardContent></Card>
        )}
      </div>

      {completedReminders.length > 0 && (
        <div className="space-y-2">
          <Button variant="ghost" size="sm" onClick={() => setShowCompleted(!showCompleted)}>
            {showCompleted ? "Hide" : "Show"} completed ({completedReminders.length})
          </Button>
          {showCompleted && completedReminders.map((r) => <ReminderCard key={r.id} reminder={r} />)}
        </div>
      )}
    </div>
  );
}
