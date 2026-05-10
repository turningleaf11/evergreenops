import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckSquare, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface ActionItem {
  id: string;
  meeting_id: string;
  text: string;
  assignee_email: string | null;
  assignee_user_id: string | null;
  converted_task_id: string | null;
  completed: boolean;
  sort_order: number;
}

export function ActionItemList({ meetingId, showEmpty = true }: { meetingId: string; showEmpty?: boolean }) {
  const { user } = useAuth();
  const [items, setItems] = useState<ActionItem[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("meeting_action_items")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("sort_order");
    if (data) setItems(data as any);
  };

  useEffect(() => { load(); }, [meetingId]);

  const toggle = async (item: ActionItem) => {
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, completed: !i.completed } : i));
    await supabase.from("meeting_action_items").update({ completed: !item.completed }).eq("id", item.id);
  };

  const convertToTask = async (item: ActionItem) => {
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: item.text,
        description: `From meeting action item`,
        assigned_to: item.assignee_user_id || user?.id,
        created_by: user?.id,
        status: "todo",
        priority: "medium",
      })
      .select()
      .single();
    if (error || !data) {
      toast({ title: "Error", description: error?.message, variant: "destructive" });
      return;
    }
    await supabase.from("meeting_action_items").update({ converted_task_id: data.id }).eq("id", item.id);
    toast({ title: "Task created", description: item.text });
    load();
  };

  if (items.length === 0) {
    if (!showEmpty) return null;
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
          No action items captured for this meeting.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-1.5">
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="p-3 flex items-center gap-3">
            <Checkbox checked={item.completed} onCheckedChange={() => toggle(item)} />
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm", item.completed && "line-through text-muted-foreground")}>{item.text}</p>
              {item.assignee_email && (
                <p className="text-[10px] text-muted-foreground mt-0.5">→ {item.assignee_email}</p>
              )}
            </div>
            {item.converted_task_id ? (
              <Link to={`/tasks/${item.converted_task_id}`} className="text-[11px] text-primary hover:underline flex items-center gap-1">
                Task <ArrowRight className="h-3 w-3" />
              </Link>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => convertToTask(item)} className="text-[11px] h-7">
                Convert to task
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
