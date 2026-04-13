import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Plus, Trash2, Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface TaskTemplate {
  id: string;
  title: string;
  description: string;
  subtasks: any[];
  tags: string[];
  priority: string;
  assignee_id: string | null;
  due_date_offset_days: number | null;
  recurrence_rule: any | null;
  created_by: string | null;
}

interface TaskTemplateManagerProps {
  onUseTemplate: (template: TaskTemplate) => void;
  profiles: { user_id: string; full_name: string | null }[];
}

export default function TaskTemplateManager({ onUseTemplate, profiles }: TaskTemplateManagerProps) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", priority: "medium",
    due_date_offset_days: "", tags: "",
  });

  const fetchTemplates = async () => {
    const { data } = await supabase.from("task_templates").select("*").order("created_at", { ascending: false });
    if (data) setTemplates(data as any);
  };

  useEffect(() => { if (open) fetchTemplates(); }, [open]);

  const createTemplate = async () => {
    if (!form.title.trim()) return;
    const { error } = await supabase.from("task_templates").insert({
      title: form.title,
      description: form.description,
      priority: form.priority,
      due_date_offset_days: form.due_date_offset_days ? parseInt(form.due_date_offset_days) : null,
      tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      created_by: user?.id,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Template created" });
      setCreateOpen(false);
      setForm({ title: "", description: "", priority: "medium", due_date_offset_days: "", tags: "" });
      fetchTemplates();
    }
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from("task_templates").delete().eq("id", id);
    fetchTemplates();
    toast({ title: "Template deleted" });
  };

  const useTemplate = (t: TaskTemplate) => {
    onUseTemplate(t);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <FileText className="h-4 w-4 mr-1" /> From Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Task Templates
            <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3 w-3 mr-1" /> New
            </Button>
          </DialogTitle>
        </DialogHeader>

        {createOpen && (
          <Card className="border-primary/30">
            <CardContent className="py-3 space-y-3">
              <div>
                <Label className="text-xs">Title</Label>
                <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className="text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Priority</Label>
                  <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Due in (days)</Label>
                  <Input type="number" value={form.due_date_offset_days} onChange={e => setForm(p => ({ ...p, due_date_offset_days: e.target.value }))} className="h-8 text-sm" placeholder="e.g. 7" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Tags (comma-separated)</Label>
                <Input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} className="h-8 text-sm" placeholder="design, review" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={createTemplate}>Save Template</Button>
                <Button size="sm" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {templates.map(t => (
            <Card key={t.id} className="hover:bg-accent/20 transition-colors">
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px] capitalize">{t.priority}</Badge>
                      {t.due_date_offset_days && (
                        <span className="text-[10px] text-muted-foreground">Due in {t.due_date_offset_days}d</span>
                      )}
                      {(t.tags || []).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => useTemplate(t)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteTemplate(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {templates.length === 0 && !createOpen && (
            <p className="text-sm text-muted-foreground text-center py-6">No templates yet. Create one to get started.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
