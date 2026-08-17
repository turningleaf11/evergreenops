import { useParams, Link, useNavigate } from "react-router-dom";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  FileText, Pin, Database, Activity, Zap, BookOpen,
  Users, Maximize2, LayoutGrid,
  LinkIcon, Paperclip, StickyNote, ImageIcon, Plus, Trash2, ExternalLink, Download,
  MoreHorizontal, ChevronDown,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState, useEffect } from "react";

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
import { usePageGrants } from "@/hooks/usePageAccess";
import { toast } from "sonner";
import "@/components/RichTextEditor.css";
import { EmptyState } from "@/components/shared/EmptyState";
import { OrbitRoster } from "@/components/orbit/OrbitRoster";
import { TeamHubManager } from "@/components/orbit/TeamHubManager";
import { OrbitProgramOverview } from "@/components/orbit/OrbitProgramOverview";
import { DepartmentOverviewV2, type ViewerRole } from "@/components/department/DepartmentOverviewV2";
import { DepartmentWorkTab } from "@/components/department/DepartmentWorkTab";
import { DepartmentPeopleTab } from "@/components/department/DepartmentPeopleTab";
import { useDeptTemplate } from "@/hooks/useDeptTemplate";

interface Profile { user_id: string; full_name: string | null; avatar_url: string | null; department_id: string | null; title?: string | null; reports_to?: string | null; is_leader?: boolean; }
interface Announcement { id: string; title: string; content: string | null; pinned: boolean; }
interface Doc { id: string; title: string; description?: string; author_name: string | null; updated_at: string; visibility: string; shared_with: any; tags: string[] | null; icon?: string | null; }
interface DB { id: string; title: string; description: string | null; icon: string | null; visibility: string; shared_with: any; }
interface Goal { id: string; title: string; progress: number; status: string; quarter: string; deadline?: string | null; }
interface ProjectFull { id: string; title: string; status: string; priority: string; owner_id: string | null; due_date?: string | null; updated_at?: string | null; }
interface Task { id: string; title: string; status: string; priority: string; project_id: string | null; assigned_to?: string | null; due_date?: string | null; updated_at?: string | null; }
interface Issue { id: string; title: string; status: string; priority: number; }
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

export default function DepartmentPage() {
  const { id } = useParams<{ id: string }>();
  const { departments } = useDepartments();
  const dept = departments.find((d) => d.id === id);
  const navigate = useNavigate();
  const { user, isAdmin, profile } = useAuth();
  const { grants } = usePageGrants();
  const isDeptLeader = isAdmin || (!!profile?.is_leader && profile?.department_id === id);
  // Roster management = admins, or anyone explicitly granted the orbit_manage capability.
  const canManageOrbit = isAdmin || grants.has("orbit_manage");

  // Viewer role drives the role-aware first-row ordering in the new Overview.
  const viewerRole: ViewerRole = isAdmin ? "admin" : isDeptLeader ? "leader" : "member";

  // Configurable per-dept template (sales / operations / portfolio / creative / ...).
  // Controls what queue/focus/stuck/KPI rules apply inside the universal block spine.
  const { template: deptTemplate } = useDeptTemplate(id);

  const [members, setMembers] = useState<Profile[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [dbs, setDbs] = useState<DB[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<ProjectFull[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
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
      const [profilesRes, announcementsRes, docsRes, dbsRes, goalsRes, projectsRes, issuesRes, allProfilesRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, avatar_url, department_id, title, reports_to, is_leader").eq("department_id", id),
        supabase.from("announcements").select("id, title, content, pinned").eq("department_id", id),
        supabase.from("documents").select("id, title, author_name, updated_at, visibility, shared_with, tags, icon"),
        supabase.from("databases_meta").select("id, title, description, icon, visibility, shared_with"),
        supabase.from("goals").select("id, title, progress, status, quarter, deadline").eq("department_id", id).eq("year", currentYear),
        supabase.from("projects").select("id, title, status, priority, owner_id, due_date, updated_at").eq("department_id", id).eq("archived", false),
        supabase.from("issues").select("id, title, status, priority").eq("department_id", id).eq("status", "open").order("priority", { ascending: true }).limit(10),
        supabase.from("profiles").select("user_id, full_name, avatar_url, department_id, title, reports_to, is_leader"),
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

      // Fetch tasks for department projects
      const deptProjectIds = deptProjects.map(p => p.id);
      if (deptProjectIds.length > 0) {
        const { data: deptTasks } = await supabase.from("tasks").select("id, title, status, priority, project_id, assigned_to, due_date, updated_at").in("project_id", deptProjectIds).limit(200);
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
      if (!url) {
        toast.error("Upload failed. Check storage permissions and try again.");
        setPinUploading(false);
        return;
      }
      if (id) {
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
        } else if (error) {
          toast.error("Failed to save pin: " + error.message);
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

  const deptColor = dept.color || "220 65% 48%";

  // Access guard: non-admins can only view their own department
  if (!isAdmin && profile?.department_id !== id) {
    return (
      <div className="p-6 max-w-6xl mx-auto text-center py-20">
        <h1 className="text-xl font-semibold">Access Denied</h1>
        <p className="text-muted-foreground mt-2">You don't have access to this department.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1500px] mx-auto space-y-6">
      {/* Department Header with accent */}
      <div className="relative">
        <div className="absolute inset-x-0 top-0 h-1 rounded-t-lg" style={{ backgroundColor: `hsl(${deptColor})` }} />
        <div className="pt-4 flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight truncate">{dept.name}</h1>
            {dept.description && <p className="text-muted-foreground mt-1 text-sm">{dept.description}</p>}
          </div>
          {pinboardItems.filter(p => p.type === "link" && p.url).length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Zap className="h-3.5 w-3.5" /> Quick Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {pinboardItems.filter(p => p.type === "link" && p.url).map(pin => (
                  <DropdownMenuItem key={pin.id} asChild>
                    <a href={pin.url!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                      <ExternalLink className="h-3.5 w-3.5" />
                      {pin.title}
                    </a>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {!dept.is_program && <TabsTrigger value="work">Work</TabsTrigger>}
          {dept.is_program && canManageOrbit && <TabsTrigger value="roster">Roster</TabsTrigger>}
          {dept.is_program && canManageOrbit && <TabsTrigger value="team-hub">Team Hub</TabsTrigger>}
          <TabsTrigger value="people">People</TabsTrigger>
          {!dept.is_program && <TabsTrigger value="resources">Resources</TabsTrigger>}
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

          {dept.is_program && (
            <OrbitProgramOverview
              departmentId={id!}
              docs={docs}
              openDocPreview={openDocPreview}
            />
          )}

          {/* The universal "what's next" surface for every non-program dept.
             Five-block spine: Today's Focus / My Queue / Goals / Stuck / Team,
             reordered by viewer role. Template (sales/ops/creative/portfolio)
             controls the RULES inside each block but the structure is the
             same for every dept type — productizable as a SaaS surface. */}
          {!dept.is_program && (
            <DepartmentOverviewV2
              deptName={dept.name}
              deptId={id!}
              deptColor={deptColor}
              template={deptTemplate}
              viewerRole={viewerRole}
              currentUserId={user?.id}
              isAdmin={isAdmin}
              goals={goals}
              tasks={tasks}
              projects={projects}
              issues={issues}
              members={members}
              getName={getName}
              onTaskClick={openTaskDrawer}
              onProjectClick={openProjectDrawer}
            />
          )}

        </TabsContent>

        {!dept.is_program && (
          <TabsContent value="work" className="mt-4">
            <DepartmentWorkTab
              projects={projects}
              tasks={tasks}
              members={members}
              currentUserId={user?.id}
              getName={getName}
            />
          </TabsContent>
        )}

        {dept.is_program && canManageOrbit && (
          <TabsContent value="roster" className="mt-4">
            <OrbitRoster departmentId={id!} />
          </TabsContent>
        )}

        {dept.is_program && canManageOrbit && (
          <TabsContent value="team-hub" className="mt-4">
            <TeamHubManager />
          </TabsContent>
        )}


        {!dept.is_program && (
          <TabsContent value="resources" className="space-y-8 mt-4">
            {/* PINBOARD — quick-access surface for the team. Lives here (not on
                Overview) because Overview is reserved for live "what's next"
                signal; pinboard is "where to find stuff." */}
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
                  {pinboardItems.map(pin => {
                    const isImage = pin.type === "image" && !!pin.url;
                    return (
                      <Card key={pin.id} className="group hover:border-primary/40 transition-colors overflow-hidden">
                        {isImage && (
                          <a href={pin.url!} target="_blank" rel="noopener noreferrer" className="block aspect-video bg-muted overflow-hidden">
                            <img src={pin.url!} alt={pin.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          </a>
                        )}
                        <CardContent className="p-3 space-y-1.5">
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex items-center gap-2 min-w-0">
                              {pinTypeIcon(pin.type)}
                              <p className="text-sm font-medium truncate">{pin.title}</p>
                            </div>
                            <button
                              onClick={() => deletePinboardItem(pin.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              title="Remove pin"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                            </button>
                          </div>
                          {pin.type === "note" ? (
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">{pin.description}</p>
                          ) : pin.description ? (
                            <p className="text-[11px] text-muted-foreground line-clamp-2">{pin.description}</p>
                          ) : null}
                          {(pin.type === "link" || pin.type === "file") && pin.url && (
                            <a
                              href={pin.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                            >
                              {pin.type === "file" ? <><Download className="h-3 w-3" /> Download</> : <><ExternalLink className="h-3 w-3" /> Open</>}
                            </a>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center space-y-2">
                    <LayoutGrid className="h-6 w-6 mx-auto text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No pins yet</p>
                    <p className="text-xs text-muted-foreground/70">Add quick links, files, screenshots, or notes — anything your team should have at hand.</p>
                  </CardContent>
                </Card>
              )}
            </section>

            {/* Structured library (SOPs, playbooks, scripts, references) */}
            <ResourcesSection docs={docs} dbs={dbs} openDocPreview={openDocPreview} />
          </TabsContent>
        )}

        <TabsContent value="people" className="mt-4">
          <DepartmentPeopleTab
            members={members}
            allProfiles={profiles}
            tasks={tasks}
            projects={projects}
            deptColor={deptColor}
            onNavigateToPeople={() => navigate("/people")}
          />
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
        onTitleChange={async (newTitle) => {
          if (!drawerItem) return;
          const table = drawerType === "project" ? "projects" : "tasks";
          await supabase.from(table).update({ title: newTitle }).eq("id", drawerItem.id);
          setDrawerItem((prev: any) => prev ? { ...prev, title: newTitle } : null);
        }}
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

// Tags we treat as content "types" — these become section groups in the resources section.
// Anything else falls into "Other".
const TYPE_TAGS = ["sop", "script", "playbook", "training", "resource"] as const;
type ResourceTypeTag = (typeof TYPE_TAGS)[number] | "other";

const TYPE_LABELS: Record<ResourceTypeTag, string> = {
  sop: "SOPs",
  script: "Scripts",
  playbook: "Playbooks",
  training: "Training",
  resource: "Resources",
  other: "Other",
};

function bucketDoc(tags: string[] | null): ResourceTypeTag {
  if (!tags || tags.length === 0) return "other";
  for (const t of TYPE_TAGS) if (tags.includes(t)) return t;
  return "other";
}

function ResourcesSection({ docs, dbs, openDocPreview }: { docs: Doc[]; dbs: DB[]; openDocPreview: (id: string) => void; }) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // All track:xxx tags present, surfaced as filter chips alongside type tags
  const trackTags = Array.from(new Set(
    docs.flatMap((d) => (d.tags ?? []).filter((t) => t.startsWith("track:")))
  )).sort();

  const filtered = docs.filter((d) => {
    const matchesSearch = !search || d.title.toLowerCase().includes(search.toLowerCase()) || (d.tags ?? []).some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchesFilter = !activeFilter || (d.tags ?? []).includes(activeFilter);
    return matchesSearch && matchesFilter;
  });

  // Group by type tag
  const buckets: Record<ResourceTypeTag, Doc[]> = { sop: [], script: [], playbook: [], training: [], resource: [], other: [] };
  filtered.forEach((d) => { buckets[bucketDoc(d.tags)].push(d); });
  const orderedBuckets = (Object.keys(TYPE_LABELS) as ResourceTypeTag[]).filter((k) => buckets[k].length > 0);

  if (docs.length === 0 && dbs.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <BookOpen className="h-4 w-4" /> Resources & Playbooks
        </h2>
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No shared resources yet</CardContent></Card>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <BookOpen className="h-4 w-4" /> Resources & Playbooks
          <span className="text-[10px] text-muted-foreground/60 normal-case tracking-normal">({docs.length} {docs.length === 1 ? "doc" : "docs"}, {dbs.length} {dbs.length === 1 ? "list" : "lists"})</span>
        </h2>
        <div className="relative">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search resources…"
            className="h-7 text-xs w-48"
          />
        </div>
      </div>

      {/* Filter chips */}
      {(trackTags.length > 0 || docs.length > 0) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveFilter(null)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
              !activeFilter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All
          </button>
          {trackTags.map((t) => (
            <button
              key={t}
              onClick={() => setActiveFilter(activeFilter === t ? null : t)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                activeFilter === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-emerald-100/60 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              {t.replace("track:", "")}
            </button>
          ))}
        </div>
      )}

      {/* Documents grouped by type */}
      {orderedBuckets.length > 0 ? (
        <div className="space-y-4">
          {orderedBuckets.map((bucket) => (
            <div key={bucket} className="space-y-1.5">
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 px-1">
                {TYPE_LABELS[bucket]} <span className="text-muted-foreground/40">· {buckets[bucket].length}</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {buckets[bucket].map((d) => (
                  <button
                    key={d.id}
                    onClick={() => openDocPreview(d.id)}
                    className="text-left flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/40 bg-card/60 hover:bg-muted/50 hover:border-border transition-colors group"
                  >
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground truncate">{d.title}</p>
                      {(d.tags ?? []).filter((t) => t.startsWith("track:")).length > 0 && (
                        <p className="text-[10px] text-muted-foreground/70 truncate">
                          {(d.tags ?? []).filter((t) => t.startsWith("track:")).map((t) => t.replace("track:", "")).join(" · ")}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : docs.length > 0 ? (
        <p className="text-xs text-muted-foreground/60 italic px-1 py-2">No matches.</p>
      ) : null}

      {/* Lists */}
      {dbs.length > 0 && (
        <div className="space-y-1.5 pt-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 px-1">
            Lists <span className="text-muted-foreground/40">· {dbs.length}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {dbs.map((d) => (
              <Link key={d.id} to={`/databases/${d.id}`} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/40 bg-card/60 hover:bg-muted/50 hover:border-border transition-colors">
                <Database className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm truncate flex-1">{d.title}</span>
                {d.description && <span className="text-[10px] text-muted-foreground/70 truncate max-w-32">{d.description}</span>}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

