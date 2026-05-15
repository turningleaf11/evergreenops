import { useState } from "react";
import { useStrategyFlow, StrategyItemType, STATUS_LABELS } from "@/lib/strategy-flow";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Target, ShieldAlert, Gavel, X, MessageSquare, Lightbulb, Sparkles, FolderKanban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const typeConfig: Record<StrategyItemType, { label: string; icon: React.ElementType; color: string; light: boolean }> = {
  note: { label: "Note", icon: MessageSquare, color: "bg-muted text-foreground border-border", light: true },
  idea: { label: "Idea", icon: Lightbulb, color: "bg-violet-500/10 text-violet-700 border-violet-200", light: true },
  objective: { label: "Objective", icon: Target, color: "bg-emerald-500/10 text-emerald-700 border-emerald-200", light: false },
  constraint: { label: "Constraint", icon: ShieldAlert, color: "bg-amber-500/10 text-amber-700 border-amber-200", light: false },
  decision: { label: "Decision", icon: Gavel, color: "bg-blue-500/10 text-blue-700 border-blue-200", light: false },
};

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  acknowledged: "bg-amber-100 text-amber-700",
  in_execution: "bg-emerald-100 text-emerald-700",
  resolved: "bg-muted text-muted-foreground",
};

export function StrategyItemCreator() {
  const { addStrategyItem, strategyItems, updateStrategyItem, deleteStrategyItem, loading } = useStrategyFlow();
  const { departments } = useDepartments();
  const { user } = useAuth();
  const currentUserId = user?.id || "";
  const [creating, setCreating] = useState(false);
  const [type, setType] = useState<StrategyItemType>("note");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);

  const isLightType = typeConfig[type].light;

  const toggleDept = (id: string) => {
    setSelectedDepts((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    await addStrategyItem({
      type,
      title: title.trim(),
      description: description.trim(),
      createdBy: currentUserId,
      assignedDepartments: selectedDepts,
      status: "new",
    });
    setCreating(false);
    setType("note");
    setTitle("");
    setDescription("");
    setSelectedDepts([]);
    toast.success(`${typeConfig[type].label} sent`);
  };

  const handleUpgrade = async (id: string, newType: StrategyItemType) => {
    await updateStrategyItem(id, { type: newType } as any);
    toast.success(`Promoted to ${typeConfig[newType].label}`);
  };

  const navigate = useNavigate();
  const handleConvertToProject = async (item: typeof strategyItems[number]) => {
    if (!user) return;
    const { data: prof } = await supabase.from("profiles").select("workspace_id").eq("user_id", user.id).maybeSingle();
    const ws = (prof as any)?.workspace_id ?? null;
    const deptId = item.assignedDepartments[0] || null;
    const { data, error } = await supabase.from("projects").insert({
      title: item.title,
      description: item.description || "",
      created_by: user.id,
      owner_id: user.id,
      status: "not_started",
      priority: "medium",
      workspace_id: ws,
      department_id: deptId,
    } as any).select("id").maybeSingle();
    if (error) {
      toast.error("Failed to create project: " + error.message);
      return;
    }
    await updateStrategyItem(item.id, { status: "in_execution" } as any);
    toast.success("Project created — directive moved to In Execution");
    if (data?.id) {
      navigate(`/projects/${data.id}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-widest">Directives</h3>
        <button
          onClick={() => setCreating(!creating)}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Directive
        </button>
      </div>

      {creating && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex gap-1.5 flex-wrap">
            {(Object.keys(typeConfig) as StrategyItemType[]).map((t) => {
              const cfg = typeConfig[t];
              const Icon = cfg.icon;
              const active = type === t;
              return (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    active ? cfg.color + " ring-1 ring-current/20" : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {cfg.label}
                </button>
              );
            })}
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isLightType ? "What's the directive? (one line)" : `What is the ${typeConfig[type].label.toLowerCase()}?`}
            className="w-full bg-transparent text-sm font-medium border-b border-border pb-2 outline-none placeholder:text-muted-foreground/40"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter" && isLightType && !e.shiftKey) handleCreate(); }}
          />

          {!isLightType && (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Context, reasoning, and expected outcome..."
              className="w-full bg-transparent text-sm border border-border rounded-lg p-3 outline-none placeholder:text-muted-foreground/40 min-h-[80px] resize-none"
            />
          )}

          <div>
            <p className="text-xs text-muted-foreground mb-2">Send to:</p>
            <div className="flex flex-wrap gap-1.5">
              {departments.map((d) => (
                <button
                  key={d.id}
                  onClick={() => toggleDept(d.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    selectedDepts.includes(d.id)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setCreating(false)} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!title.trim()}
              className="text-xs font-medium bg-primary text-primary-foreground px-4 py-1.5 rounded-lg disabled:opacity-40"
            >
              Send Directive
            </button>
          </div>
        </div>
      )}

      {/* Directives list */}
      <div className="space-y-2">
        {loading && strategyItems.length === 0 && (
          <p className="text-xs text-muted-foreground/60 text-center py-4">Loading directives…</p>
        )}
        {strategyItems.map((item) => {
          const cfg = typeConfig[item.type] || typeConfig.note;
          const Icon = cfg.icon;
          return (
            <div key={item.id} className="rounded-lg border border-border bg-card px-4 py-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className={`text-[10px] uppercase tracking-wide font-medium ${cfg.color.split(" ").filter(c => c.startsWith("text-")).join(" ") || "text-muted-foreground"}`}>
                    {cfg.label}
                  </span>
                  <span className="text-sm font-medium text-foreground truncate">{item.title}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="secondary" className={`text-[10px] ${statusColors[item.status]}`}>
                    {STATUS_LABELS[item.status] ?? item.status}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted"
                        title="Actions"
                      >
                        <Sparkles className="h-3 w-3" />
                        Actions
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleConvertToProject(item)} className="text-xs gap-2">
                        <FolderKanban className="h-3 w-3" /> Convert to Project
                      </DropdownMenuItem>
                      {cfg.light && (["objective", "constraint", "decision"] as StrategyItemType[]).map((t) => {
                        const TIcon = typeConfig[t].icon;
                        return (
                          <DropdownMenuItem key={t} onClick={() => handleUpgrade(item.id, t)} className="text-xs gap-2">
                            <TIcon className="h-3 w-3" /> Promote to {typeConfig[t].label}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <button
                    onClick={() => deleteStrategyItem(item.id)}
                    className="text-muted-foreground/50 hover:text-destructive transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {item.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 pl-6">{item.description}</p>
              )}
              <div className="flex items-center gap-2 pl-6">
                <span className="text-[10px] text-muted-foreground">
                  {item.assignedDepartments.map((id) => departments.find((d) => d.id === id)?.name).filter(Boolean).join(", ") || "No teams"}
                </span>
                {item.responses.length > 0 && (
                  <span className="text-[10px] text-primary font-medium">{item.responses.length} response(s)</span>
                )}
              </div>
            </div>
          );
        })}
        {!loading && strategyItems.length === 0 && (
          <p className="text-xs text-muted-foreground/60 text-center py-4">No directives yet. A directive is anything you want your leadership team to know, act on, or weigh in on.</p>
        )}
      </div>
    </div>
  );
}
