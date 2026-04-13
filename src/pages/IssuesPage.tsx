import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Plus, Search, ArrowRight, CheckCircle2, MessageSquare, Lightbulb, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Issue = {
  id: string; title: string; description: string; raised_by: string | null;
  department_id: string | null; priority: number; status: string;
  root_cause: string; discussion_notes: string; resolution: string;
  resolved_action_type: string; resolved_action_id: string | null;
  created_at: string; updated_at: string;
};

const priorityLabels: Record<number, { label: string; color: string }> = {
  1: { label: "High", color: "bg-red-100 text-red-800" },
  2: { label: "Medium", color: "bg-yellow-100 text-yellow-800" },
  3: { label: "Low", color: "bg-green-100 text-green-800" },
};

const statusSteps = ["open", "identifying", "discussing", "solved", "dismissed"];

export default function IssuesPage() {
  const { user, isAdmin } = useAuth();
  const { departments } = useDepartments();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState("2");
  const [newDept, setNewDept] = useState("");
  const [viewTab, setViewTab] = useState("open");

  const fetchAll = useCallback(async () => {
    const [i, p] = await Promise.all([
      supabase.from("issues").select("*").order("priority").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name"),
    ]);
    if (i.data) setIssues(i.data);
    if (p.data) setProfiles(p.data);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const getName = (uid: string | null) => {
    if (!uid) return "Unknown";
    return profiles.find(p => p.user_id === uid)?.full_name || "Unknown";
  };

  const createIssue = async () => {
    if (!newTitle.trim()) return;
    const { error } = await supabase.from("issues").insert({
      title: newTitle, description: newDesc, priority: parseInt(newPriority),
      raised_by: user?.id, department_id: newDept || null,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Issue raised" }); setCreateOpen(false); setNewTitle(""); setNewDesc(""); fetchAll(); }
  };

  const updateIssue = async (id: string, updates: Partial<Issue>) => {
    const { error } = await supabase.from("issues").update(updates).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      fetchAll();
      if (selectedIssue?.id === id) setSelectedIssue(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const solveWithTask = async (issue: Issue) => {
    const { data, error } = await supabase.from("tasks").insert({
      title: `[Issue] ${issue.title}`, description: issue.resolution || issue.root_cause,
      created_by: user?.id, assigned_to: user?.id,
    }).select().single();
    if (data) {
      await updateIssue(issue.id, { status: "solved", resolved_action_type: "todo", resolved_action_id: data.id });
      toast({ title: "Issue solved — task created" });
    }
  };

  const solveWithProject = async (issue: Issue) => {
    const { data, error } = await supabase.from("projects").insert({
      title: `[Issue] ${issue.title}`, description: issue.resolution || issue.root_cause,
      created_by: user?.id, owner_id: user?.id,
    }).select().single();
    if (data) {
      await updateIssue(issue.id, { status: "solved", resolved_action_type: "project", resolved_action_id: data.id });
      toast({ title: "Issue solved — project created" });
    }
  };

  const dismiss = async (issue: Issue) => {
    await updateIssue(issue.id, { status: "dismissed", resolved_action_type: "none" });
    toast({ title: "Issue dismissed" });
  };

  const openIssues = issues.filter(i => !["solved", "dismissed"].includes(i.status));
  const resolvedIssues = issues.filter(i => ["solved", "dismissed"].includes(i.status));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Issues (IDS)</h1>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Raise Issue</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Raise an Issue</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Title</Label><Input value={newTitle} onChange={e => setNewTitle(e.target.value)} /></div>
              <div><Label>Description</Label><Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Priority</Label>
                  <Select value={newPriority} onValueChange={setNewPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">High</SelectItem>
                      <SelectItem value="2">Medium</SelectItem>
                      <SelectItem value="3">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {departments.length > 0 && (
                  <div>
                    <Label>Department</Label>
                    <Select value={newDept} onValueChange={setNewDept}>
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>
                        {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <Button onClick={createIssue} className="w-full">Submit</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={viewTab} onValueChange={setViewTab}>
        <TabsList>
          <TabsTrigger value="open">Open ({openIssues.length})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({resolvedIssues.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="space-y-3">
          {openIssues.map(issue => (
            <Card key={issue.id} className="cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => setSelectedIssue(issue)}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{issue.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`text-xs ${priorityLabels[issue.priority]?.color}`}>{priorityLabels[issue.priority]?.label}</Badge>
                      <span className="text-xs text-muted-foreground">by {getName(issue.raised_by)}</span>
                      <Badge variant="outline" className="text-xs capitalize">{issue.status}</Badge>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
          {openIssues.length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No open issues. 🎉</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="resolved" className="space-y-3">
          {resolvedIssues.map(issue => (
            <Card key={issue.id} className="opacity-70">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{issue.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs capitalize">{issue.status}</Badge>
                      {issue.resolved_action_type !== "none" && (
                        <Badge variant="outline" className="text-xs">→ {issue.resolved_action_type}</Badge>
                      )}
                      {issue.resolution && <span className="text-xs text-muted-foreground truncate max-w-60">{issue.resolution}</span>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {resolvedIssues.length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No resolved issues yet.</CardContent></Card>
          )}
        </TabsContent>
      </Tabs>

      {/* IDS Detail Dialog */}
      <Dialog open={!!selectedIssue} onOpenChange={o => !o && setSelectedIssue(null)}>
        <DialogContent className="max-w-lg">
          {selectedIssue && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" /> {selectedIssue.title}
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">{selectedIssue.description}</p>

              {/* IDS Steps */}
              <div className="space-y-4 mt-4">
                {/* Step 1: Identify */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-primary" />
                    <h4 className="font-medium text-sm">1. Identify — Root Cause</h4>
                  </div>
                  <Textarea
                    value={selectedIssue.root_cause || ""}
                    onChange={e => setSelectedIssue(p => p ? { ...p, root_cause: e.target.value } : null)}
                    placeholder="What is the real, underlying issue?"
                    rows={2}
                  />
                  {selectedIssue.status === "open" && (
                    <Button size="sm" variant="outline" onClick={() => updateIssue(selectedIssue.id, { status: "identifying", root_cause: selectedIssue.root_cause })}>
                      Save & Move to Discuss <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </div>

                {/* Step 2: Discuss */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <h4 className="font-medium text-sm">2. Discuss</h4>
                  </div>
                  <Textarea
                    value={selectedIssue.discussion_notes || ""}
                    onChange={e => setSelectedIssue(p => p ? { ...p, discussion_notes: e.target.value } : null)}
                    placeholder="Key discussion points and perspectives..."
                    rows={3}
                  />
                  {["open", "identifying"].includes(selectedIssue.status) && (
                    <Button size="sm" variant="outline" onClick={() => updateIssue(selectedIssue.id, { status: "discussing", discussion_notes: selectedIssue.discussion_notes, root_cause: selectedIssue.root_cause })}>
                      Save & Move to Solve <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </div>

                {/* Step 3: Solve */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    <h4 className="font-medium text-sm">3. Solve</h4>
                  </div>
                  <Textarea
                    value={selectedIssue.resolution || ""}
                    onChange={e => setSelectedIssue(p => p ? { ...p, resolution: e.target.value } : null)}
                    placeholder="Resolution / action to take..."
                    rows={2}
                  />
                  {!["solved", "dismissed"].includes(selectedIssue.status) && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => {
                        updateIssue(selectedIssue.id, { root_cause: selectedIssue.root_cause, discussion_notes: selectedIssue.discussion_notes, resolution: selectedIssue.resolution });
                        solveWithTask(selectedIssue);
                        setSelectedIssue(null);
                      }}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Create Task
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => {
                        updateIssue(selectedIssue.id, { root_cause: selectedIssue.root_cause, discussion_notes: selectedIssue.discussion_notes, resolution: selectedIssue.resolution });
                        solveWithProject(selectedIssue);
                        setSelectedIssue(null);
                      }}>
                        Create Project
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        updateIssue(selectedIssue.id, { root_cause: selectedIssue.root_cause, discussion_notes: selectedIssue.discussion_notes, resolution: selectedIssue.resolution });
                        dismiss(selectedIssue);
                        setSelectedIssue(null);
                      }}>
                        <X className="h-3 w-3 mr-1" /> Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
