import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export type AgentMeta = { slug: string; name: string; emoji: string | null; avatar_url: string | null; accent_color: string | null };
export type ExistingCandidate = { id: string; title: string; _kind: "task" | "agent_task" };

const currentQuarter = () => { const m = new Date().getMonth(); return `Q${Math.floor(m / 3) + 1}`; };
const currentYear = () => new Date().getFullYear();

// The single create surface for Goals, Projects, and Tasks — used by the
// standalone Execution Hub / AI Hub tabs and by a Project's own "Add task"
// (with the project locked via lockProjectId). One component, one set of
// options, regardless of where it's opened from.
export default function CreateEntityDialog({
  title, open, onOpenChange, onSubmit, type, goals, projects, departments, profiles,
  agents = [], repos = [], lockProjectId, existingCandidates, onLinkExisting,
}: {
  title: string; open: boolean; onOpenChange: (o: boolean) => void;
  onSubmit: (data: any) => void; type: "goal" | "project" | "task";
  goals: { id: string; title: string }[]; projects: { id: string; title: string }[];
  departments: { id: string; name: string }[];
  profiles: { user_id: string; full_name: string | null }[];
  agents?: AgentMeta[];
  repos?: { slug: string; name: string; github_repo: string }[];
  // When set, the task is created directly under this project — the
  // project picker is hidden rather than shown pre-filled.
  lockProjectId?: string;
  // When both are set (type === "task" only), the dialog gains an
  // "Existing" tab alongside "New" — attaching a standalone task/agent_task
  // to lockProjectId instead of creating a new one.
  existingCandidates?: ExistingCandidate[];
  onLinkExisting?: (candidate: ExistingCandidate) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [showDesc, setShowDesc] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [existingQuery, setExistingQuery] = useState("");

  const showExistingTab = type === "task" && !!existingCandidates && !!onLinkExisting;
  const filteredExisting = (existingCandidates || []).filter((c) =>
    c.title.toLowerCase().includes(existingQuery.toLowerCase()),
  );

  const handleSubmit = () => {
    if (!form.title?.trim()) { toast.error("Title required"); return; }
    onSubmit({
      ...form,
      project_id: lockProjectId || form.project_id,
      year: form.year ? parseInt(form.year) : currentYear(),
      quarter: form.quarter || currentQuarter(),
    });
    setForm({});
    setShowDesc(false);
    setShowAdvanced(false);
  };

  const quarters = ["Q1", "Q2", "Q3", "Q4"];

  const newTaskForm = (
    <div className="space-y-3">
      <Input
        value={form.title || ""}
        onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
        placeholder={`${type.charAt(0).toUpperCase() + type.slice(1)} name...`}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
        autoFocus
      />

      {!showDesc ? (
        <button onClick={() => setShowDesc(true)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          + Add description
        </button>
      ) : (
        <Textarea
          value={form.description || ""}
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          placeholder="Description..."
          rows={2}
          className="text-sm"
        />
      )}

      {type === "goal" && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Quarter</span>
            <div className="flex gap-1">
              {quarters.map(q => (
                <button
                  key={q}
                  onClick={() => setForm(p => ({ ...p, quarter: q }))}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    (form.quarter || currentQuarter()) === q
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
            <Input
              type="number"
              value={form.year || currentYear()}
              onChange={e => setForm(p => ({ ...p, year: e.target.value }))}
              className="w-20 h-8 text-xs"
            />
          </div>

          {!showAdvanced ? (
            <button onClick={() => setShowAdvanced(true)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              + Target, deadline & alignment
            </button>
          ) : (
            <div className="space-y-2">
              <Input value={form.measurable_target || ""} onChange={e => setForm(p => ({ ...p, measurable_target: e.target.value }))} placeholder="Measurable target, e.g. Increase revenue by 20%" className="text-sm" />
              <Input type="date" value={form.deadline || ""} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} className="text-sm" />
              <Textarea value={form.alignment_notes || ""} onChange={e => setForm(p => ({ ...p, alignment_notes: e.target.value }))} rows={2} placeholder="How does this align with company strategy?" className="text-sm" />
            </div>
          )}
        </>
      )}

      {type === "project" && goals.length > 0 && (
        <Select value={form.goal_id || ""} onValueChange={v => setForm(p => ({ ...p, goal_id: v }))}>
          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="+ Link to goal" /></SelectTrigger>
          <SelectContent>
            {goals.map(g => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {type === "task" && (
        <>
          <div className="flex gap-2">
            {!lockProjectId && projects.length > 0 && (
              <Select value={form.project_id || ""} onValueChange={v => setForm(p => ({ ...p, project_id: v }))}>
                <SelectTrigger className="h-9 text-sm flex-1"><SelectValue placeholder="+ Project" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={form.assigned_to || ""} onValueChange={v => setForm(p => ({ ...p, assigned_to: v }))}>
              <SelectTrigger className="h-9 text-sm flex-1"><SelectValue placeholder="+ Assign" /></SelectTrigger>
              <SelectContent>
                {profiles.length > 0 && <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">People</div>}
                {[...profiles].sort((a, b) => (a.full_name || "Unknown").localeCompare(b.full_name || "Unknown")).map(p => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Unknown"}</SelectItem>
                ))}
                {agents.length > 0 && <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-1">AI agents</div>}
                {[...agents].sort((a, b) => a.name.localeCompare(b.name)).map(a => (
                  <SelectItem key={a.slug} value={a.slug}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {agents.some(a => a.slug === form.assigned_to) && (
            <div className="flex gap-2">
              <Select value={form.agent_type || "general"} onValueChange={v => setForm(p => ({ ...p, agent_type: v }))}>
                <SelectTrigger className="h-9 text-sm flex-1"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  {["general", "research", "code", "decision", "communication"].map(t => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={form.agent_repo || ""} onValueChange={v => setForm(p => ({ ...p, agent_repo: v }))}>
                <SelectTrigger className="h-9 text-sm flex-1"><SelectValue placeholder="+ Repo (optional)" /></SelectTrigger>
                <SelectContent>
                  {repos.map(r => <SelectItem key={r.slug} value={r.slug}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </>
      )}

      {(type === "goal" || type === "project") && departments.length > 0 && (
        <Select value={form.department_id || ""} onValueChange={v => setForm(p => ({ ...p, department_id: v }))}>
          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="+ Department" /></SelectTrigger>
          <SelectContent>
            {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      <div className="flex justify-end pt-1">
        <Button onClick={handleSubmit} size="sm">Create</Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> {title}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {showExistingTab ? (
          <Tabs defaultValue="new">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="new">New</TabsTrigger>
              <TabsTrigger value="existing">Existing</TabsTrigger>
            </TabsList>
            <TabsContent value="new" className="pt-3">
              {newTaskForm}
            </TabsContent>
            <TabsContent value="existing" className="pt-3">
              <div className="space-y-2">
                <Input
                  value={existingQuery}
                  onChange={(e) => setExistingQuery(e.target.value)}
                  placeholder="Search standalone tasks…"
                  autoFocus
                />
                <div className="max-h-64 overflow-y-auto space-y-0.5">
                  {filteredExisting.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-1 py-2">
                      {existingQuery ? "No matches" : "No standalone tasks to attach"}
                    </p>
                  ) : (
                    filteredExisting.map((c) => {
                      const Icon = c._kind === "agent_task" ? Sparkles : CheckCircle2;
                      return (
                        <button
                          key={`${c._kind}-${c.id}`}
                          onClick={() => { onLinkExisting?.(c); onOpenChange(false); }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent/60 text-left"
                        >
                          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{c.title}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        ) : newTaskForm}
      </DialogContent>
    </Dialog>
  );
}
