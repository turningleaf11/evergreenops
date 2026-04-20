import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import type { Cadence } from "./CadencesTab";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cadence: Cadence | null;
  onSaved: () => void;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function CadenceEditor({ open, onOpenChange, cadence, onSaved }: Props) {
  const { user } = useAuth();
  const { departments } = useDepartments();
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [docs, setDocs] = useState<{ id: string; title: string }[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState<string>("");
  const [deptId, setDeptId] = useState<string>("");
  const [sopDocId, setSopDocId] = useState<string>("");
  const [scheduleType, setScheduleType] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [priority, setPriority] = useState("medium");

  useEffect(() => {
    if (!open) return;
    supabase.from("profiles").select("user_id, full_name").then(({ data }) => data && setProfiles(data));
    supabase.from("documents").select("id, title").eq("status", "active").then(({ data }) => data && setDocs(data));
  }, [open]);

  useEffect(() => {
    if (cadence) {
      setTitle(cadence.title);
      setDescription(cadence.description || "");
      setOwnerId(cadence.owner_id || user?.id || "");
      setDeptId(cadence.department_id || "");
      setSopDocId(cadence.sop_doc_id || "");
      setScheduleType((cadence.schedule_type as any) || "weekly");
      setDayOfWeek(cadence.schedule_config?.day_of_week ?? 1);
      setDayOfMonth(cadence.schedule_config?.day_of_month ?? 1);
      setPriority(cadence.task_template?.priority || "medium");
    } else {
      setTitle(""); setDescription(""); setOwnerId(user?.id || "");
      setDeptId(""); setSopDocId(""); setScheduleType("weekly");
      setDayOfWeek(1); setDayOfMonth(1); setPriority("medium");
    }
  }, [cadence, open, user?.id]);

  const save = async () => {
    if (!title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }

    const schedule_config: any = {};
    if (scheduleType === "weekly") schedule_config.day_of_week = dayOfWeek;
    if (scheduleType === "monthly") schedule_config.day_of_month = dayOfMonth;

    const task_template = { title: title.trim(), priority };

    const payload: any = {
      title: title.trim(),
      description: description.trim(),
      owner_id: ownerId || user?.id,
      department_id: deptId || null,
      sop_doc_id: sopDocId || null,
      schedule_type: scheduleType,
      schedule_config,
      task_template,
      is_active: true,
    };

    let error;
    if (cadence) {
      ({ error } = await supabase.from("cadences").update(payload).eq("id", cadence.id));
    } else {
      payload.created_by = user?.id;
      ({ error } = await supabase.from("cadences").insert(payload));
    }

    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: cadence ? "Cadence updated" : "Cadence created" }); onSaved(); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{cadence ? "Edit cadence" : "New cadence"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Build leads list and import to GHL" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Why this matters and what success looks like" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Owner</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                <SelectContent>
                  {profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "User"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Department</Label>
              <Select value={deptId || "none"} onValueChange={(v) => setDeptId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Schedule</Label>
            <div className="flex gap-2 mt-1">
              <Select value={scheduleType} onValueChange={(v: any) => setScheduleType(v)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
              {scheduleType === "weekly" && (
                <Select value={String(dayOfWeek)} onValueChange={(v) => setDayOfWeek(Number(v))}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {scheduleType === "monthly" && (
                <Select value={String(dayOfMonth)} onValueChange={(v) => setDayOfMonth(Number(v))}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(n => <SelectItem key={n} value={String(n)}>Day {n}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Task priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Linked SOP doc (optional)</Label>
              <Select value={sopDocId || "none"} onValueChange={(v) => setSopDocId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {docs.map(d => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>Save cadence</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
