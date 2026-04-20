import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { getUSFederalHolidays } from "@/lib/us-holidays";

interface WorkspaceHoliday {
  id: string;
  name: string;
  date: string;
  is_recurring: boolean;
  color: string;
}

const FEDERAL_KEY = "us_federal_holidays_enabled";

export function HolidaysSection() {
  const { user } = useAuth();
  const [holidays, setHolidays] = useState<WorkspaceHoliday[]>([]);
  const [federalEnabled, setFederalEnabled] = useState(true);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [recurring, setRecurring] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(FEDERAL_KEY);
    if (stored !== null) setFederalEnabled(stored === "true");
    load();
  }, []);

  const load = async () => {
    const { data } = await supabase.from("workspace_holidays").select("*").order("date");
    if (data) setHolidays(data as any);
  };

  const toggleFederal = (v: boolean) => {
    setFederalEnabled(v);
    localStorage.setItem(FEDERAL_KEY, String(v));
  };

  const add = async () => {
    if (!name.trim() || !date) return;
    const { error } = await supabase.from("workspace_holidays").insert({
      name: name.trim(), date, is_recurring: recurring, created_by: user?.id,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Holiday added" });
    setName(""); setDate(""); setRecurring(true);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("workspace_holidays").delete().eq("id", id);
    load();
  };

  const fed = getUSFederalHolidays(new Date().getFullYear()).slice(0, 5);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> US Federal Holidays
          </CardTitle>
          <CardDescription>Show federal holidays in This Week and across the calendar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm">Enabled</span>
            <Switch checked={federalEnabled} onCheckedChange={toggleFederal} />
          </div>
          {federalEnabled && (
            <div className="mt-3 text-xs text-muted-foreground space-y-0.5">
              {fed.map((h, i) => (
                <div key={i} className="flex justify-between">
                  <span>{h.name}</span>
                  <span className="tabular-nums">{format(h.date, "MMM d, yyyy")}</span>
                </div>
              ))}
              <p className="text-[10px] mt-1.5 italic">+ 6 more annually</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Custom company holidays</CardTitle>
          <CardDescription>Add company-specific dates (off days, anniversaries, etc.)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-5">
              <Label className="text-xs">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Founders Day" />
            </div>
            <div className="col-span-3">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="col-span-2 flex items-center gap-2 pt-5">
              <Switch checked={recurring} onCheckedChange={setRecurring} />
              <span className="text-xs">Annual</span>
            </div>
            <div className="col-span-2 pt-5">
              <Button size="sm" onClick={add} className="w-full"><Plus className="h-3.5 w-3.5 mr-1" /> Add</Button>
            </div>
          </div>

          {holidays.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No custom holidays yet</p>
          ) : (
            <div className="space-y-1">
              {holidays.map((h) => (
                <div key={h.id} className="flex items-center justify-between p-2 rounded-md bg-muted/40">
                  <div>
                    <span className="text-sm font-medium">{h.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {format(new Date(h.date), "MMM d, yyyy")}
                      {h.is_recurring && " · recurring"}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => remove(h.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
