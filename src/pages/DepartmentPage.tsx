import { useParams, Link } from "react-router-dom";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  FileText, Pin, Database, Target, FolderKanban, CheckSquare,
  AlertTriangle, Activity, Bot, Zap, Brain,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { StrategyFeed } from "@/components/StrategyFeed";
import { TranslationBlockComponent } from "@/components/TranslationBlock";
import { ExecutionSnapshot } from "@/components/ExecutionSnapshot";
import { UpwardProposalForm } from "@/components/UpwardProposal";
import { LeadershipAiChat } from "@/components/LeadershipAiChat";
import { formatDistanceToNow } from "date-fns";

interface Profile { user_id: string; full_name: string | null; avatar_url: string | null; department_id: string | null; }
interface Announcement { id: string; title: string; content: string | null; pinned: boolean; }
interface Doc { id: string; title: string; author_name: string | null; updated_at: string; visibility: string; shared_with: any; }
interface DB { id: string; title: string; description: string | null; visibility: string; shared_with: any; }
interface Goal { id: string; title: string; progress: number; status: string; quarter: string; }
interface Project { id: string; title: string; status: string; priority: string; }
interface Task { id: string; title: string; status: string; priority: string; }
interface Issue { id: string; title: string; status: string; priority: number; }
interface ActivityEvent { id: string; actor_name: string | null; action: string; entity_type: string; entity_title: string | null; created_at: string; }

function isSharedWithDept(item: { visibility: string; shared_with: any }, deptId: string): boolean {
  if (item.visibility === "workspace") return true;
  if (item.visibility === "department" && item.shared_with) {
    const sw = typeof item.shared_with === "string" ? JSON.parse(item.shared_with) : item.shared_with;
    return (sw.departmentIds || []).includes(deptId);
  }
  return false;
}

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

export default function DepartmentPage() {
  const { id } = useParams<{ id: string }>();
  const { departments } = useDepartments();
  const dept = departments.find((d) => d.id === id);

  const [members, setMembers] = useState<Profile[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [dbs, setDbs] = useState<DB[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const currentYear = new Date().getFullYear();
      const [profilesRes, announcementsRes, docsRes, dbsRes, goalsRes, projectsRes, tasksRes, issuesRes, activityRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, avatar_url, department_id").eq("department_id", id),
        supabase.from("announcements").select("id, title, content, pinned").eq("department_id", id),
        supabase.from("documents").select("id, title, author_name, updated_at, visibility, shared_with"),
        supabase.from("databases_meta").select("id, title, description, visibility, shared_with"),
        supabase.from("goals").select("id, title, progress, status, quarter").eq("department_id", id).eq("year", currentYear),
        supabase.from("projects").select("id, title, status, priority").eq("department_id", id),
        supabase.from("tasks").select("id, title, status, priority").in("status", ["todo", "in_progress"]).limit(20),
        supabase.from("issues").select("id, title, status, priority").eq("department_id", id).eq("status", "open").order("priority", { ascending: true }).limit(10),
        supabase.from("activity_events").select("id, actor_name, action, entity_type, entity_title, created_at").eq("department_id", id).order("created_at", { ascending: false }).limit(15),
      ]);

      setMembers((profilesRes.data as Profile[]) || []);
      setAnnouncements((announcementsRes.data as Announcement[]) || []);
      
      // Filter docs/dbs by visibility
      const allDocs = (docsRes.data || []) as Doc[];
      const allDbs = (dbsRes.data || []) as DB[];
      setDocs(allDocs.filter((d) => isSharedWithDept(d, id)));
      setDbs(allDbs.filter((d) => isSharedWithDept(d, id)));

      setGoals((goalsRes.data as Goal[]) || []);
      setProjects((projectsRes.data as Project[]) || []);
      // Tasks don't have department_id directly — filter by project assignees or show all active for now
      // We'll filter tasks that belong to this dept's projects
      const deptProjectIds = ((projectsRes.data as Project[]) || []).map(p => p.id);
      // Re-query tasks for these projects
      if (deptProjectIds.length > 0) {
        const { data: deptTasks } = await supabase.from("tasks").select("id, title, status, priority").in("project_id", deptProjectIds).in("status", ["todo", "in_progress"]).limit(20);
        setTasks((deptTasks as Task[]) || []);
      } else {
        setTasks([]);
      }
      setIssues((issuesRes.data as Issue[]) || []);
      setActivity((activityRes.data as ActivityEvent[]) || []);
      setLoading(false);
    };
    load();
  }, [id]);

  if (!dept) return <div className="p-6 text-muted-foreground">Department not found.</div>;
  if (loading) return <div className="p-6 text-muted-foreground text-sm">Loading...</div>;

  const activeProjects = projects.filter(p => p.status === "in_progress" || p.status === "not_started");

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{dept.name}</h1>
        <p className="text-muted-foreground mt-1">{dept.description}</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="leadership">Leadership</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8 mt-4">
          {/* Announcements */}
          {announcements.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Announcements</h2>
              {announcements.map((a) => (
                <Card key={a.id}>
                  <CardContent className="py-3 px-4 flex items-start gap-2">
                    <Pin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div><p className="font-medium text-sm">{a.title}</p><p className="text-xs text-muted-foreground mt-0.5">{a.content}</p></div>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}

          {/* Goals */}
          {goals.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Target className="h-4 w-4" /> Goals</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {goals.map((g) => (
                  <Card key={g.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm truncate">{g.title}</p>
                        <Badge variant="secondary" className={`text-[10px] ${statusColors[g.status] || ""}`}>{g.status.replace("_", " ")}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={g.progress} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground font-medium">{g.progress}%</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{g.quarter}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Active Projects & Tasks */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2"><FolderKanban className="h-4 w-4" /> Active Projects ({activeProjects.length})</h2>
            {activeProjects.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeProjects.map((p) => (
                  <Link key={p.id} to={`/projects/${p.id}`}>
                    <Card className="hover:border-primary/40 transition-colors">
                      <CardContent className="p-4 flex items-center justify-between">
                        <p className="font-medium text-sm truncate">{p.title}</p>
                        <Badge variant="secondary" className={`text-[10px] shrink-0 ${statusColors[p.status] || ""}`}>{p.status.replace("_", " ")}</Badge>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active projects.</p>
            )}

            {tasks.length > 0 && (
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground"><CheckSquare className="h-3.5 w-3.5" /> Active Tasks ({tasks.length})</h3>
                <div className="space-y-1">
                  {tasks.slice(0, 8).map((t) => (
                    <Link key={t.id} to={`/tasks/${t.id}`} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-muted transition-colors">
                      <Badge variant="secondary" className={`text-[10px] ${statusColors[t.status] || ""}`}>{t.status}</Badge>
                      <span className="truncate">{t.title}</span>
                    </Link>
                  ))}
                  {tasks.length > 8 && <p className="text-xs text-muted-foreground pl-2">+{tasks.length - 8} more</p>}
                </div>
              </div>
            )}
          </section>

          {/* Open Issues */}
          {issues.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Open Issues ({issues.length})</h2>
              <div className="space-y-1">
                {issues.map((issue) => (
                  <Link key={issue.id} to="/issues" className="flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-muted transition-colors">
                    <Badge variant="secondary" className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400">P{issue.priority}</Badge>
                    <span className="truncate">{issue.title}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Shared Docs & Databases */}
          {(docs.length > 0 || dbs.length > 0) && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Shared Resources</h2>
              {docs.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> Documents ({docs.length})</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {docs.slice(0, 6).map((d) => (
                      <Link key={d.id} to={`/docs?doc=${d.id}`}>
                        <Card className="hover:border-primary/40 transition-colors">
                          <CardContent className="p-3">
                            <p className="text-sm font-medium truncate">{d.title}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{d.author_name} · {d.updated_at?.split("T")[0]}</p>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {dbs.length > 0 && (
                <div className="space-y-2 mt-3">
                  <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2"><Database className="h-3.5 w-3.5" /> Databases ({dbs.length})</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {dbs.slice(0, 6).map((d) => (
                      <Link key={d.id} to={`/databases?db=${d.id}`}>
                        <Card className="hover:border-primary/40 transition-colors">
                          <CardContent className="p-3">
                            <p className="text-sm font-medium truncate">{d.title}</p>
                            {d.description && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{d.description}</p>}
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Team */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Team ({members.length})</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {members.map((m) => (
                <Card key={m.user_id}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <Avatar className="h-9 w-9"><AvatarFallback className="text-xs bg-muted">{(m.full_name || "U").split(" ").map((n) => n[0]).join("")}</AvatarFallback></Avatar>
                    <div className="min-w-0"><p className="font-medium text-sm truncate">{m.full_name || "Unnamed"}</p></div>
                  </CardContent>
                </Card>
              ))}
              {members.length === 0 && <p className="text-sm text-muted-foreground col-span-full">No team members assigned to this department yet.</p>}
            </div>
          </section>

          {/* Recent Activity */}
          {activity.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Activity className="h-4 w-4" /> Recent Activity</h2>
              <div className="space-y-2">
                {activity.map((e) => (
                  <div key={e.id} className="flex items-start gap-3 text-sm py-1">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted mt-0.5">
                      <Activity className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p>
                        <span className="font-medium">{e.actor_name || "Someone"}</span>{" "}
                        <span className="text-muted-foreground">{e.action.replace(/_/g, " ")}</span>
                        {e.entity_title && <span className="font-medium"> "{e.entity_title}"</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </TabsContent>

        <TabsContent value="leadership" className="mt-4">
          <EmbeddedLeadership deptId={id!} />
        </TabsContent>
      </Tabs>
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
