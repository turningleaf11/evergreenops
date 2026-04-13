import { useParams, Link, useNavigate } from "react-router-dom";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  FileText, Pin, Database, Target, FolderKanban, CheckSquare,
  AlertTriangle, Activity, Bot, Zap, Brain, Crosshair, BookOpen,
  Users, Flame, Shield, CircleDot, Maximize2, LayoutGrid,
  LinkIcon, Paperclip, StickyNote, ImageIcon, Plus, Trash2, ExternalLink, Download,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { StrategyFeed } from "@/components/StrategyFeed";
import { TranslationBlockComponent } from "@/components/TranslationBlock";
import { ExecutionSnapshot } from "@/components/ExecutionSnapshot";
import { UpwardProposalForm } from "@/components/UpwardProposal";
import { LeadershipAiChat } from "@/components/LeadershipAiChat";
import { formatDistanceToNow } from "date-fns";
import DetailDrawer from "@/components/DetailDrawer";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { uploadFile, triggerFileInput } from "@/lib/file-upload";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import "@/components/RichTextEditor.css";

interface Profile { user_id: string; full_name: string | null; avatar_url: string | null; department_id: string | null; }
interface Announcement { id: string; title: string; content: string | null; pinned: boolean; }
interface Doc { id: string; title: string; description?: string; author_name: string | null; updated_at: string; visibility: string; shared_with: any; }
interface DB { id: string; title: string; description: string | null; icon: string | null; visibility: string; shared_with: any; }
interface Goal { id: string; title: string; progress: number; status: string; quarter: string; }
interface ProjectFull { id: string; title: string; status: string; priority: string; owner_id: string | null; }
interface Task { id: string; title: string; status: string; priority: string; project_id: string | null; }
interface Issue { id: string; title: string; status: string; priority: number; }
interface StrategyItem { id: string; title: string; type: string; status: string; description: string | null; assigned_departments: string[] | null; }
interface EntityActivity { id: string; action: string; entity_type: string; entity_id: string; actor_id: string | null; created_at: string; metadata: any; }
interface PinboardItem { id: string; department_id: string; type: string; title: string; url: string | null; description: string | null; icon: string | null; sort_order: number; created_by: string | null; }

function isSharedWithDept(item: { visibility: string; shared_with: any }, deptId: string): boolean {
  if (item.visibility === "workspace" || item.visibility === "team") return true;
  if ((item.visibility === "departments" || item.visibility === "department") && item.shared_with) {
    const sw = typeof item.shared_with === "string" ? JSON.parse(item.shared_with) : item.shared_with;
    return (sw.departmentIds || []).includes(deptId);
  }
  return false;
}

const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

const statusColors: Record<string, string> = {
  on_track: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  at_risk: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  behind: "bg-destructive/15 text-destructive",
  completed: "bg-primary/15 text-primary",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  todo: "bg-muted text-muted-foreground",
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  not_started: "bg-muted text-muted-foreground",
  open: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-700 dark:text-red-400",
  high: "bg-red-500/10 text-red-600 dark:text-red-400",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  low: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

export default function DepartmentPage() {
  const { id } = useParams<{ id: string }>();
  const { departments } = useDepartments();
  const dept = departments.find((d) => d.id === id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [members, setMembers] = useState<Profile[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [dbs, setDbs] = useState<DB[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<ProjectFull[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [strategyItems, setStrategyItems] = useState<StrategyItem[]>([]);
  const [activity, setActivity] = useState<EntityActivity[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Drawer state for tasks/projects
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState<"project" | "task">("task");
  const [drawerItem, setDrawerItem] = useState<any>(null);

  // Doc preview sheet state
  const [docSheetOpen, setDocSheetOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ id: string; title: string; content: string | null; author_name: string | null } | null>(null);

  // Pinboard state
  const [pinboardItems, setPinboardItems] = useState<PinboardItem[]>([]);
  const [addPinOpen, setAddPinOpen] = useState(false);
  const [newPin, setNewPin] = useState({ type: "link", title: "", url: "", description: "" });
  const [pinUploading, setPinUploading] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const currentYear = new Date().getFullYear();
      const [profilesRes, announcementsRes, docsRes, dbsRes, goalsRes, projectsRes, issuesRes, strategyRes, allProfilesRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, avatar_url, department_id").eq("department_id", id),
        supabase.from("announcements").select("id, title, content, pinned").eq("department_id", id),
        supabase.from("documents").select("id, title, author_name, updated_at, visibility, shared_with"),
        supabase.from("databases_meta").select("id, title, description, icon, visibility, shared_with"),
        supabase.from("goals").select("id, title, progress, status, quarter").eq("department_id", id).eq("year", currentYear),
        supabase.from("projects").select("id, title, status, priority, owner_id").eq("department_id", id),
        supabase.from("issues").select("id, title, status, priority").eq("department_id", id).eq("status", "open").order("priority", { ascending: true }).limit(10),
        supabase.from("strategy_items").select("id, title, type, status, description, assigned_departments"),
        supabase.from("profiles").select("user_id, full_name, avatar_url, department_id"),
      ]);

      setMembers((profilesRes.data as Profile[]) || []);
      setAnnouncements((announcementsRes.data as Announcement[]) || []);
      setProfiles((allProfilesRes.data as Profile[]) || []);

      const allDocs = (docsRes.data || []) as Doc[];
      const allDbs = (dbsRes.data || []) as DB[];
      setDocs(allDocs.filter((d) => isSharedWithDept(d, id)));
      setDbs(allDbs.filter((d) => isSharedWithDept(d, id)));

      setGoals((goalsRes.data as Goal[]) || []);
      const deptProjects = (projectsRes.data as ProjectFull[]) || [];
      setProjects(deptProjects);
      setIssues((issuesRes.data as Issue[]) || []);

      // Filter strategy items assigned to this department
      const allStrategy = (strategyRes.data as StrategyItem[]) || [];
      setStrategyItems(allStrategy.filter(s => (s.assigned_departments || []).includes(id)));

      // Fetch tasks for department projects
      const deptProjectIds = deptProjects.map(p => p.id);
      if (deptProjectIds.length > 0) {
        const { data: deptTasks } = await supabase.from("tasks").select("id, title, status, priority, project_id").in("project_id", deptProjectIds).in("status", ["todo", "in_progress"]).limit(20);
        setTasks((deptTasks as Task[]) || []);
      } else {
        setTasks([]);
      }

      // Fetch entity_activity for dept's projects and tasks
      const entityIds = [...deptProjectIds];
      if (entityIds.length > 0) {
        const { data: actData } = await supabase.from("entity_activity").select("id, action, entity_type, entity_id, actor_id, created_at, metadata").in("entity_id", entityIds).order("created_at", { ascending: false }).limit(15);
        setActivity((actData as EntityActivity[]) || []);
      } else {
        setActivity([]);
      }

      // Fetch pinboard items
      const { data: pins } = await supabase.from("department_pinboard").select("*").eq("department_id", id).order("sort_order", { ascending: true });
      setPinboardItems((pins as PinboardItem[]) || []);

      setLoading(false);
    };
    load();
  }, [id]);

  if (!dept) return <div className="p-6 text-muted-foreground">Department not found.</div>;
  if (loading) return <div className="p-6 text-muted-foreground text-sm">Loading...</div>;

  const getName = (uid: string | null) => {
    if (!uid) return null;
    return profiles.find(p => p.user_id === uid)?.full_name || null;
  };

  const openProjectDrawer = (p: ProjectFull) => {
    setDrawerType("project");
    setDrawerItem(p);
    setDrawerOpen(true);
  };

  const openTaskDrawer = (t: Task) => {
    setDrawerType("task");
    setDrawerItem(t);
    setDrawerOpen(true);
  };

  const handleDrawerStatusChange = async (status: string) => {
    if (!drawerItem) return;
    const table = drawerType === "project" ? "projects" : "tasks";
    await supabase.from(table).update({ status }).eq("id", drawerItem.id);
    if (drawerType === "project") {
      setProjects(prev => prev.map(p => p.id === drawerItem.id ? { ...p, status } : p));
    } else {
      setTasks(prev => prev.map(t => t.id === drawerItem.id ? { ...t, status } : t));
    }
    setDrawerItem((prev: any) => prev ? { ...prev, status } : prev);
  };

  const openDocPreview = async (docId: string) => {
    const { data } = await supabase.from("documents").select("id, title, content, author_name").eq("id", docId).single();
    if (data) {
      setPreviewDoc(data);
      setDocSheetOpen(true);
    }
  };

  // Pinboard helpers
  const addPinboardItem = async () => {
    if (!id || !newPin.title.trim()) return;
    setPinUploading(true);
    const { data, error } = await supabase.from("department_pinboard").insert({
      department_id: id,
      type: newPin.type,
      title: newPin.title.trim(),
      url: newPin.url || null,
      description: newPin.description || "",
      icon: newPin.type === "link" ? "Link" : newPin.type === "file" ? "Paperclip" : newPin.type === "note" ? "StickyNote" : "Image",
      sort_order: pinboardItems.length,
      created_by: user?.id || null,
    } as any).select().single();
    if (!error && data) {
      setPinboardItems(prev => [...prev, data as PinboardItem]);
      toast.success("Pin added");
    }
    setNewPin({ type: "link", title: "", url: "", description: "" });
    setPinUploading(false);
    setAddPinOpen(false);
  };

  const handlePinFileUpload = () => {
    triggerFileInput("*", async (file) => {
      setPinUploading(true);
      const url = await uploadFile(file);
      if (url && id) {
        const isImage = file.type.startsWith("image/");
        const { data, error } = await supabase.from("department_pinboard").insert({
          department_id: id,
          type: isImage ? "image" : "file",
          title: file.name,
          url,
          description: "",
          icon: isImage ? "Image" : "Paperclip",
          sort_order: pinboardItems.length,
          created_by: user?.id || null,
        } as any).select().single();
        if (!error && data) {
          setPinboardItems(prev => [...prev, data as PinboardItem]);
          toast.success("File pinned");
        }
      }
      setPinUploading(false);
    });
  };

  const deletePinboardItem = async (pinId: string) => {
    await supabase.from("department_pinboard").delete().eq("id", pinId);
    setPinboardItems(prev => prev.filter(p => p.id !== pinId));
  };

  const pinTypeIcon = (type: string) => {
    switch (type) {
      case "link": return <LinkIcon className="h-4 w-4 text-blue-500" />;
      case "file": return <Paperclip className="h-4 w-4 text-amber-500" />;
      case "note": return <StickyNote className="h-4 w-4 text-green-500" />;
      case "image": return <ImageIcon className="h-4 w-4 text-purple-500" />;
      default: return <LinkIcon className="h-4 w-4" />;
    }
  };

  // Department Focus data
  const currentPriorities = [...goals]
    .filter(g => g.status !== "completed")
    .sort((a, b) => a.progress - b.progress)
    .slice(0, 2);

  const keyObjective = strategyItems.find(s => s.type === "objective" && (s.status === "in_execution" || s.status === "acknowledged"));
  const constraints = strategyItems.filter(s => s.type === "constraint");

  // Key initiatives — top 5 projects sorted by priority
  const keyInitiatives = [...projects]
    .sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2))
    .slice(0, 5);

  // Execution snapshot — high priority tasks
  const highPriorityTasks = [...tasks]
    .filter(t => t.priority === "urgent" || t.priority === "high")
    .slice(0, 6);
  const allActiveTasks = highPriorityTasks.length > 0 ? highPriorityTasks : tasks.slice(0, 6);

  // Team with project ownership
  const memberWithLeads = members.map(m => ({
    ...m,
    leads: projects.filter(p => p.owner_id === m.user_id).map(p => p.title),
  }));

  const deptColor = dept.color || "220 65% 48%";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Department Header with accent */}
      <div className="relative">
        <div className="absolute inset-x-0 top-0 h-1 rounded-t-lg" style={{ backgroundColor: `hsl(${deptColor})` }} />
        <div className="pt-4">
          <h1 className="text-2xl font-bold tracking-tight">{dept.name}</h1>
          {dept.description && <p className="text-muted-foreground mt-1">{dept.description}</p>}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="leadership">Leadership</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8 mt-4">
          {/* Announcements */}
          {announcements.length > 0 && (
            <section className="space-y-2">
              {announcements.map((a) => (
                <Card key={a.id} className="border-l-4" style={{ borderLeftColor: `hsl(${deptColor})` }}>
                  <CardContent className="py-3 px-4 flex items-start gap-2">
                    <Pin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div><p className="font-medium text-sm">{a.title}</p>{a.content && <p className="text-xs text-muted-foreground mt-0.5">{a.content}</p>}</div>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}

          {/* DEPARTMENT FOCUS — hero section */}
          <section>
            <Card className="border-2" style={{ borderColor: `hsl(${deptColor} / 0.3)` }}>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Crosshair className="h-5 w-5" style={{ color: `hsl(${deptColor})` }} />
                  <h2 className="text-lg font-bold">Department Focus</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Current Priorities */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Flame className="h-3.5 w-3.5" /> Current Priorities
                    </h3>
                    {currentPriorities.length > 0 ? currentPriorities.map(g => (
                      <div key={g.id} className="p-2.5 rounded-md bg-accent/40 space-y-1.5">
                        <p className="text-sm font-medium">{g.title}</p>
                        <div className="flex items-center gap-2">
                          <Progress value={g.progress} className="h-1.5 flex-1" />
                          <span className="text-[11px] text-muted-foreground">{g.progress}%</span>
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground italic">No priorities set yet</p>
                    )}
                  </div>

                  {/* Key Objective */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5" /> Key Objective
                    </h3>
                    {keyObjective ? (
                      <div className="p-2.5 rounded-md bg-accent/40">
                        <p className="text-sm font-medium">{keyObjective.title}</p>
                        {keyObjective.description && <p className="text-xs text-muted-foreground mt-1">{keyObjective.description}</p>}
                        <Badge variant="secondary" className={`text-[10px] mt-2 ${statusColors[keyObjective.status] || ""}`}>
                          {keyObjective.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No active objective</p>
                    )}
                  </div>

                  {/* Constraints */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5" /> Constraints
                    </h3>
                    {constraints.length > 0 ? constraints.map(c => (
                      <div key={c.id} className="p-2.5 rounded-md bg-accent/40">
                        <p className="text-sm font-medium">{c.title}</p>
                        {c.description && <p className="text-xs text-muted-foreground mt-1">{c.description}</p>}
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground italic">No constraints — clear runway</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* KEY INITIATIVES */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <FolderKanban className="h-4 w-4" /> Key Initiatives
            </h2>
            {keyInitiatives.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {keyInitiatives.map((p) => (
                  <div key={p.id} className="cursor-pointer" onClick={() => openProjectDrawer(p)}>
                    <Card className="hover:border-primary/40 transition-colors h-full">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm">{p.title}</p>
                          <Badge variant="secondary" className={`text-[10px] shrink-0 ${priorityColors[p.priority] || ""}`}>
                            {p.priority}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className={`text-[10px] ${statusColors[p.status] || ""}`}>
                            {p.status.replace(/_/g, " ")}
                          </Badge>
                          {getName(p.owner_id) && (
                            <span className="text-[11px] text-muted-foreground">{getName(p.owner_id)}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            ) : (
              <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No initiatives yet — create a project to get started.</CardContent></Card>
            )}
          </section>

          {/* EXECUTION SNAPSHOT */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <CheckSquare className="h-4 w-4" /> Execution Snapshot
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tasks */}
              <Card>
                <CardContent className="p-4 space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground">
                    {highPriorityTasks.length > 0 ? "High-Priority Tasks" : "Active Tasks"}
                  </h3>
                  {allActiveTasks.length > 0 ? (
                    <div className="space-y-1">
                      {allActiveTasks.map(t => (
                        <div key={t.id} onClick={() => openTaskDrawer(t)} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted transition-colors text-sm cursor-pointer">
                          <CircleDot className={`h-3.5 w-3.5 shrink-0 ${t.status === "in_progress" ? "text-blue-500" : "text-muted-foreground"}`} />
                          <span className="truncate flex-1">{t.title}</span>
                          <Badge variant="secondary" className={`text-[9px] shrink-0 ${priorityColors[t.priority] || ""}`}>{t.priority}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic py-2">No active tasks</p>
                  )}
                </CardContent>
              </Card>

              {/* Issues */}
              <Card>
                <CardContent className="p-4 space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-amber-500" /> Open Issues
                  </h3>
                  {issues.length > 0 ? (
                    <div className="space-y-1">
                      {issues.slice(0, 3).map(issue => (
                        <Link key={issue.id} to="/issues" className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted transition-colors text-sm">
                          <Badge variant="secondary" className="text-[9px] bg-amber-500/15 text-amber-700 dark:text-amber-400 shrink-0">P{issue.priority}</Badge>
                          <span className="truncate">{issue.title}</span>
                        </Link>
                      ))}
                      {issues.length > 3 && <p className="text-xs text-muted-foreground pl-2">+{issues.length - 3} more open</p>}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic py-2">No open issues — smooth sailing</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>

          {/* RESOURCES & PLAYBOOKS */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Resources & Playbooks
            </h2>
            {docs.length > 0 || dbs.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {docs.slice(0, 6).map(d => (
                  <div key={d.id} className="cursor-pointer" onClick={() => openDocPreview(d.id)}>
                    <Card className="hover:border-primary/40 transition-colors h-full">
                      <CardContent className="p-3 flex items-start gap-2.5">
                        <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{d.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{d.author_name}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
                {dbs.slice(0, 6).map(d => (
                  <Link key={d.id} to={`/databases?db=${d.id}`}>
                    <Card className="hover:border-primary/40 transition-colors h-full">
                      <CardContent className="p-3 flex items-start gap-2.5">
                        <Database className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{d.title}</p>
                          {d.description && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{d.description}</p>}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No shared resources yet</CardContent></Card>
            )}
          </section>

          {/* PINBOARD */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" /> Pinboard
              </h2>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handlePinFileUpload} disabled={pinUploading}>
                  <Paperclip className="h-3 w-3 mr-1" /> Upload
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAddPinOpen(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
            </div>
            {pinboardItems.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {pinboardItems.map(pin => (
                  <Card key={pin.id} className="group hover:border-primary/40 transition-colors">
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex items-center gap-2 min-w-0">
                          {pinTypeIcon(pin.type)}
                          <p className="text-sm font-medium truncate">{pin.title}</p>
                        </div>
                        <button
                          onClick={() => deletePinboardItem(pin.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                      {pin.description && <p className="text-[11px] text-muted-foreground truncate">{pin.description}</p>}
                      {(pin.type === "link" || pin.type === "file" || pin.type === "image") && pin.url && (
                        <a
                          href={pin.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                        >
                          {pin.type === "file" ? <><Download className="h-3 w-3" /> Download</> : pin.type === "image" ? <><ExternalLink className="h-3 w-3" /> View</> : <><ExternalLink className="h-3 w-3" /> Open</>}
                        </a>
                      )}
                      {pin.type === "image" && pin.url && (
                        <img src={pin.url} alt={pin.title} className="w-full h-20 object-cover rounded mt-1" />
                      )}
                      {pin.type === "note" && (
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">{pin.description}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No pins yet — add links, files, notes, or images</CardContent></Card>
            )}
          </section>


        </TabsContent>

        <TabsContent value="leadership" className="mt-4">
          <EmbeddedLeadership deptId={id!} />
        </TabsContent>

        <TabsContent value="team" className="space-y-4 mt-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4" /> Team
          </h2>
          {memberWithLeads.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {memberWithLeads.map((m) => (
                <Card key={m.user_id}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-xs bg-muted" style={{ borderColor: `hsl(${deptColor} / 0.4)`, borderWidth: 2 }}>
                        {(m.full_name || "U").split(" ").map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{m.full_name || "Unnamed"}</p>
                      {m.leads.length > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          Leads: {m.leads.join(", ")}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No team members assigned yet</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-4 mt-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Activity className="h-4 w-4" /> Recent Activity
          </h2>
          {activity.length > 0 ? (
            <Card>
              <CardContent className="p-4 space-y-2">
                {activity.map((e) => (
                  <div key={e.id} className="flex items-start gap-3 text-sm py-1">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted mt-0.5">
                      <Activity className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p>
                        <span className="font-medium">{getName(e.actor_id) || "Someone"}</span>{" "}
                        <span className="text-muted-foreground">{e.action.replace(/_/g, " ")}</span>
                        {" on "}
                        <span className="font-medium">{e.entity_type}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No recent activity yet</CardContent></Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Task/Project Detail Drawer */}
      <DetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        type={drawerType}
        item={drawerItem}
        onStatusChange={handleDrawerStatusChange}
        getName={(uid) => getName(uid) || "Unassigned"}
      />

      {/* Doc Preview Sheet */}
      <Sheet open={docSheetOpen} onOpenChange={setDocSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="space-y-3">
            <SheetTitle className="text-lg pr-8">{previewDoc?.title}</SheetTitle>
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => { setDocSheetOpen(false); navigate(`/docs?doc=${previewDoc?.id}`); }}
            >
              <Maximize2 className="h-3.5 w-3.5 mr-1.5" /> Open full page
            </Button>
          </SheetHeader>
          <div className="mt-6">
            {previewDoc?.author_name && (
              <p className="text-xs text-muted-foreground mb-4">By {previewDoc.author_name}</p>
            )}
            {previewDoc?.content ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: previewDoc.content }}
              />
            ) : (
              <p className="text-sm text-muted-foreground italic">No content yet</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Add Pin Dialog */}
      <Dialog open={addPinOpen} onOpenChange={setAddPinOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to Pinboard</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={newPin.type} onValueChange={(v) => setNewPin(prev => ({ ...prev, type: v }))}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="link">🔗 Link / Button</SelectItem>
                <SelectItem value="note">📝 Note</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Title" value={newPin.title} onChange={(e) => setNewPin(prev => ({ ...prev, title: e.target.value }))} className="h-8 text-sm" />
            {newPin.type === "link" && (
              <Input placeholder="https://..." value={newPin.url} onChange={(e) => setNewPin(prev => ({ ...prev, url: e.target.value }))} className="h-8 text-sm" />
            )}
            <Textarea placeholder={newPin.type === "note" ? "Note content..." : "Description (optional)"} value={newPin.description} onChange={(e) => setNewPin(prev => ({ ...prev, description: e.target.value }))} className="text-sm min-h-[60px]" />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddPinOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={addPinboardItem} disabled={!newPin.title.trim() || pinUploading}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmbeddedLeadership({ deptId }: { deptId: string }) {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="strategy">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="strategy" className="text-xs"><Zap className="h-3 w-3 mr-1" />Strategy</TabsTrigger>
          <TabsTrigger value="execution" className="text-xs"><Brain className="h-3 w-3 mr-1" />Execution</TabsTrigger>
        </TabsList>
        <TabsContent value="strategy" className="space-y-6 mt-4">
          <StrategyFeed departmentId={deptId} />
          <TranslationBlockComponent departmentId={deptId} />
          <UpwardProposalForm departmentId={deptId} />
        </TabsContent>
        <TabsContent value="execution" className="mt-4">
          <ExecutionSnapshot departmentId={deptId} />
        </TabsContent>
      </Tabs>

      <button onClick={() => setChatOpen(!chatOpen)} className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors">
        <Bot className="h-5 w-5" />
      </button>
      {chatOpen && <LeadershipAiChat open={chatOpen} onOpenChange={setChatOpen} departmentId={deptId} />}
    </div>
  );
}
