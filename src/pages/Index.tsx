import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { Pin, FileText, ArrowRight, FileSpreadsheet, Send, Clock, CheckCircle2, XCircle, ListTodo, Star, X, Plus, Settings2, CalendarDays, Megaphone, User, Building2, CheckSquare, Eye, Columns2, Square, AlertTriangle, PartyPopper, Shield, Zap, Info } from "lucide-react";
import { HomeAiChat } from "@/components/home/HomeAiChat";
import { OnboardingBanner } from "@/components/OnboardingBanner";
import { ActivityFeed } from "@/components/ActivityFeed";
import { RemindersWidget } from "@/components/RemindersWidget";
import { getDeptIcon } from "@/lib/icon-map";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { WidgetCustomizer } from "@/components/home/WidgetCustomizer";
import { FeedPreview } from "@/components/home/FeedPreview";
import { useWidgetPreferences } from "@/hooks/useWidgetPreferences";
import { cn } from "@/lib/utils";
import DetailDrawer from "@/components/DetailDrawer";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

const statusColors: Record<string, string> = {
  todo: "bg-muted-foreground",
  in_progress: "bg-blue-500",
  done: "bg-green-500",
  blocked: "bg-red-500",
};

// Announcement type → visual treatment (border/icon bg/icon)
const announcementTypeStyles: Record<string, { border: string; iconBg: string; iconColor: string; chip: string; Icon: any }> = {
  urgent:      { border: "border-l-red-500",    iconBg: "bg-red-500/10",    iconColor: "text-red-600",    chip: "bg-red-500/10 text-red-700 dark:text-red-300",    Icon: AlertTriangle },
  celebration: { border: "border-l-amber-500",  iconBg: "bg-amber-500/10",  iconColor: "text-amber-600",  chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300", Icon: PartyPopper },
  policy:      { border: "border-l-indigo-500", iconBg: "bg-indigo-500/10", iconColor: "text-indigo-600", chip: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300", Icon: Shield },
  update:      { border: "border-l-blue-500",   iconBg: "bg-blue-500/10",   iconColor: "text-blue-600",   chip: "bg-blue-500/10 text-blue-700 dark:text-blue-300",     Icon: Zap },
  general:     { border: "border-l-primary",    iconBg: "bg-primary/10",    iconColor: "text-primary",    chip: "bg-primary/10 text-primary",                           Icon: Info },
};

function SortableWidget({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <button
        {...attributes}
        {...listeners}
        className="absolute -left-2 top-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing bg-card border rounded-md p-0.5 shadow-sm"
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/70" />
      </button>
      {children}
    </div>
  );
}

const Index = () => {
  const { departments } = useDepartments();
  const { user, isAdmin, profile } = useAuth();
  const navigate = useNavigate();
  const { widgets, savePreferences, resetToDefaults } = useWidgetPreferences();
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"single" | "double">(() => {
    if (typeof window === "undefined") return "double";
    return (localStorage.getItem("home_layout_mode") as "single" | "double") || "double";
  });
  const toggleLayoutMode = () => {
    const next = layoutMode === "double" ? "single" : "double";
    setLayoutMode(next);
    localStorage.setItem("home_layout_mode", next);
  };

  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [ackCounts, setAckCounts] = useState<Record<string, number>>({});
  const [myAcks, setMyAcks] = useState<Set<string>>(new Set());
  const [totalMembers, setTotalMembers] = useState(0);
  const [recentDocs, setRecentDocs] = useState<any[]>([]);
  const [formTemplates, setFormTemplates] = useState<any[]>([]);
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);
  const [fillOpen, setFillOpen] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<any>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});

  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [addingFav, setAddingFav] = useState(false);
  const [favLabel, setFavLabel] = useState("");
  const [favUrl, setFavUrl] = useState("");
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null }[]>([]);

  // Task peek drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTask, setDrawerTask] = useState<any>(null);

  const visibleDepartments = isAdmin
    ? departments
    : departments.filter((d) => d.id === profile?.department_id);

  useEffect(() => {
    const fetchAll = async () => {
      const [annRes, docRes, formRes, subRes, profilesRes, memberCountRes] = await Promise.all([
        supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(5),
        supabase.from("documents").select("id, title, author_name, updated_at, tags, visibility, shared_with").order("updated_at", { ascending: false }).limit(20),
        supabase.from("form_templates").select("*").eq("is_active", true).order("name"),
        user ? supabase.from("form_submissions").select("*").eq("submitted_by", user.id).order("created_at", { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
        supabase.from("profiles").select("user_id, full_name"),
        supabase.from("profiles").select("user_id", { count: "exact", head: true }),
      ]);
      if (annRes.data) {
        setAnnouncements(annRes.data);
        const annIds = annRes.data.map((a: any) => a.id);
        if (annIds.length > 0) {
          const { data: acks } = await supabase
            .from("announcement_acknowledgments")
            .select("announcement_id, user_id")
            .in("announcement_id", annIds);
          if (acks) {
            const counts: Record<string, number> = {};
            const mine = new Set<string>();
            acks.forEach((a: any) => {
              counts[a.announcement_id] = (counts[a.announcement_id] || 0) + 1;
              if (a.user_id === user?.id) mine.add(a.announcement_id);
            });
            setAckCounts(counts);
            setMyAcks(mine);
          }
        }
      }
      if (memberCountRes.count) setTotalMembers(memberCountRes.count);
      if (formRes.data) setFormTemplates(formRes.data);
      if (subRes.data) setMySubmissions(subRes.data as any[]);
      if (profilesRes.data) {
        setProfiles(profilesRes.data);
      }
      if (docRes.data) {
        const filtered = isAdmin
          ? docRes.data.slice(0, 3)
          : docRes.data
              .filter((doc: any) => {
                if (doc.visibility === "workspace") return true;
                if (doc.visibility === "private") return doc.author_id === profile?.user_id;
                const sw = doc.shared_with || { departmentIds: [], memberIds: [] };
                return (sw.departmentIds || []).includes(profile?.department_id) ||
                       (sw.memberIds || []).includes(profile?.user_id);
              })
              .slice(0, 3);
        setRecentDocs(filtered);
      }

      if (user) {
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id, title, status, due_date, priority, description, assigned_to, tags, subtasks")
          .eq("assigned_to", user.id)
          .neq("status", "done")
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(8);
        if (tasks) setMyTasks(tasks);
      }

      if (user) {
        const { data: favs } = await supabase
          .from("user_favorites")
          .select("*")
          .eq("user_id", user.id)
          .order("sort_order", { ascending: true });
        if (favs) setFavorites(favs);
      }
    };
    fetchAll();
  }, [isAdmin, profile, user]);

  const acknowledgeAnnouncement = async (annId: string) => {
    if (!user || myAcks.has(annId)) return;
    await supabase.from("announcement_acknowledgments").insert({
      announcement_id: annId,
      user_id: user.id,
    } as any);
    setMyAcks((prev) => new Set([...prev, annId]));
    setAckCounts((prev) => ({ ...prev, [annId]: (prev[annId] || 0) + 1 }));
  };

  useEffect(() => {
    if (!user || announcements.length === 0) return;
    const timers = announcements
      .filter((a) => !myAcks.has(a.id))
      .map((a) =>
        setTimeout(() => acknowledgeAnnouncement(a.id), 3000)
      );
    return () => timers.forEach(clearTimeout);
  }, [announcements, myAcks, user]);

  const openForm = (template: any) => {
    setActiveTemplate(template);
    setFormValues({});
    setFillOpen(true);
  };

  const submitForm = async () => {
    if (!user || !activeTemplate) return;
    for (const field of (activeTemplate.fields || [])) {
      if (field.required && !formValues[field.name]?.toString().trim()) {
        toast.error(`${field.name} is required`);
        return;
      }
    }
    const { error } = await supabase.from("form_submissions").insert({
      template_id: activeTemplate.id,
      submitted_by: user.id,
      values: formValues,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Form submitted!");
    setFillOpen(false);
    const { data } = await supabase.from("form_submissions").select("*").eq("submitted_by", user.id).order("created_at", { ascending: false }).limit(5);
    if (data) setMySubmissions(data);
  };

  const addFavorite = async () => {
    if (!user || !favLabel.trim() || !favUrl.trim()) return;
    const { error } = await supabase.from("user_favorites").insert({
      user_id: user.id,
      label: favLabel.trim(),
      url: favUrl.trim(),
      sort_order: favorites.length,
    });
    if (error) { toast.error(error.message); return; }
    setFavLabel(""); setFavUrl(""); setAddingFav(false);
    const { data } = await supabase.from("user_favorites").select("*").eq("user_id", user.id).order("sort_order", { ascending: true });
    if (data) setFavorites(data);
  };

  const removeFavorite = async (id: string) => {
    await supabase.from("user_favorites").delete().eq("id", id);
    setFavorites(favorites.filter((f) => f.id !== id));
  };

  const getName = (uid: string | null) => {
    if (!uid) return "Unassigned";
    return profiles.find(p => p.user_id === uid)?.full_name || "Unknown";
  };

  const handleTaskStatusChange = async (status: string) => {
    if (!drawerTask) return;
    const { error } = await supabase.from("tasks").update({ status }).eq("id", drawerTask.id);
    if (error) { toast.error(error.message); return; }
    setDrawerTask({ ...drawerTask, status });
    setMyTasks(prev => prev.map(t => t.id === drawerTask.id ? { ...t, status } : t));
  };

  const statusIcon: Record<string, React.ReactNode> = {
    pending: <Clock className="h-3.5 w-3.5 text-amber-500" />,
    approved: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
    denied: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = widgets.findIndex((w) => w.id === active.id);
    const newIdx = widgets.findIndex((w) => w.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const targetWidget = widgets[newIdx];
    const reordered = arrayMove(widgets, oldIdx, newIdx).map((w, i) => ({
      ...w,
      sort_order: i,
      column: w.id === String(active.id) ? targetWidget.column : w.column,
    }));
    savePreferences(reordered);
  };

  const leftWidgets = widgets.filter((w) => w.visible && w.column === "left");
  const rightWidgets = widgets.filter((w) => w.visible && w.column === "right");
  const allVisibleIds = [...leftWidgets, ...rightWidgets].map((w) => w.id);

  const renderWidget = (widgetId: string) => {
    switch (widgetId) {
      case "announcements":
        return (
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-muted-foreground/70" /> Announcements
                </h2>
              </div>
              <div className="px-4 pb-4 space-y-2">
                {announcements.length === 0 && (
                  <div className="py-6 text-center">
                    <Megaphone className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No announcements yet</p>
                  </div>
                )}
                {announcements.map((a) => {
                  const seen = ackCounts[a.id] || 0;
                  const isSeen = myAcks.has(a.id);
                  const style = announcementTypeStyles[a.type] || announcementTypeStyles.general;
                  const TypeIcon = style.Icon;
                  return (
                    <div
                      key={a.id}
                      className={cn(
                        "rounded-lg border-l-[3px] bg-card hover:bg-muted/30 transition-colors p-3 flex items-start gap-3",
                        style.border,
                        a.pinned && "shadow-sm"
                      )}
                    >
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", style.iconBg)}>
                        <TypeIcon className={cn("h-4 w-4", style.iconColor)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {a.pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                          <p className="font-semibold text-sm">{a.title}</p>
                          <span className={cn("text-[9px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded-full", style.chip)}>
                            {a.type || "general"}
                          </span>
                        </div>
                        {a.content && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.content}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5">
                            <Eye className="h-3 w-3" /> {seen}/{totalMembers} seen
                          </span>
                          {!isSeen ? (
                            <button
                              onClick={() => acknowledgeAnnouncement(a.id)}
                              className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                            >
                              <CheckSquare className="h-3 w-3" /> Mark seen
                            </button>
                          ) : (
                            <span className="text-[10px] text-green-600 flex items-center gap-0.5">
                              <CheckCircle2 className="h-3 w-3" /> Seen
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );

      case "departments":
        return (
          <Card>
            <CardContent className="p-0">
              <div className="px-4 pt-4 pb-2">
                <h2 className="text-base font-semibold">Departments</h2>
              </div>
              <div className="px-4 pb-4 space-y-1">
                {visibleDepartments.map((dept) => {
                  const Icon = getDeptIcon(dept.icon);
                  return (
                    <Link key={dept.id} to={`/department/${dept.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `hsl(${dept.color} / 0.1)`, color: `hsl(${dept.color})` }}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{dept.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{dept.description || "Department"}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );

      case "forms":
        if (formTemplates.length === 0) return null;
        return (
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground/70" /> Forms
                </h2>
                <Link to="/forms" className="text-xs text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
              </div>
              <div className="px-4 pb-4 space-y-1">
                {formTemplates.slice(0, 4).map((t) => (
                  <button key={t.id} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left" onClick={() => openForm(t)}>
                    <FileSpreadsheet className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-sm truncate">{t.name}</span>
                  </button>
                ))}
                {mySubmissions.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-border/30">
                    <p className="text-[10px] text-muted-foreground font-medium">Recent</p>
                    {mySubmissions.slice(0, 3).map((s) => (
                      <div key={s.id} className="flex items-center gap-2 text-xs py-1">
                        {statusIcon[s.status]}
                        <span className="truncate flex-1">{formTemplates.find((t: any) => t.id === s.template_id)?.name || "Form"}</span>
                        <Badge variant="secondary" className="text-[9px] capitalize">{s.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );

      case "my_tasks":
        return (
          <Card className="elevation-2">
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-muted-foreground/70" /> My Tasks
                </h2>
                <Link to="/execution" className="text-xs text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
              </div>
              <div className="px-4 pb-4 space-y-0.5">
                {myTasks.length === 0 && <p className="text-sm text-muted-foreground py-4">No tasks assigned to you. 🎉</p>}
                {myTasks.map((task) => {
                  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";
                  return (
                    <button
                      key={task.id}
                      onClick={() => { setDrawerTask(task); setDrawerOpen(true); }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                    >
                      <span className={`h-2 w-2 rounded-full shrink-0 ${statusColors[task.status] || "bg-muted-foreground"}`} />
                      <span className="text-sm font-medium truncate flex-1">{task.title}</span>
                      {task.due_date && (
                        <Badge variant={isOverdue ? "destructive" : "outline"} className="text-[10px] shrink-0">
                          {format(parseISO(task.due_date), "MMM d")}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px] capitalize shrink-0">{task.priority}</Badge>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );

      case "quick_links":
        return (
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <h2 className="text-base font-semibold flex items-center gap-2"><Star className="h-4 w-4 text-muted-foreground/70" /> Quick Links</h2>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => setAddingFav(true)}>
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
              <div className="px-4 pb-4 space-y-1">
                {addingFav && (
                  <div className="space-y-1.5 pb-2">
                    <Input placeholder="Label" value={favLabel} onChange={(e) => setFavLabel(e.target.value)} className="h-8 text-sm" />
                    <Input placeholder="URL (e.g. https://...)" value={favUrl} onChange={(e) => setFavUrl(e.target.value)} className="h-8 text-sm" />
                    <div className="flex gap-1">
                      <Button size="sm" className="h-7 text-xs" onClick={addFavorite} disabled={!favLabel.trim() || !favUrl.trim()}>Save</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAddingFav(false); setFavLabel(""); setFavUrl(""); }}>Cancel</Button>
                    </div>
                  </div>
                )}
                {favorites.length === 0 && !addingFav && <p className="text-sm text-muted-foreground py-3">No quick links yet.</p>}
                {favorites.map((fav) => (
                  <div key={fav.id} className="flex items-center gap-2 group p-1.5 rounded hover:bg-muted/50 transition-colors">
                    <Star className="h-3.5 w-3.5 text-primary shrink-0" />
                    <a href={fav.url} target="_blank" rel="noopener noreferrer" className="text-sm truncate flex-1 hover:underline">{fav.label}</a>
                    <button onClick={() => removeFavorite(fav.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );

      case "feed_preview":
        return <FeedPreview />;

      case "feed_chat":
        return <HomeAiChat />;

      case "reminders":
        return <RemindersWidget />;

      case "recent_docs":
        return (
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <h2 className="text-base font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground/70" /> Recent Docs</h2>
                <Link to="/docs" className="text-xs text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
              </div>
              <div className="px-4 pb-4 space-y-1">
                {recentDocs.map((doc) => (
                  <Link key={doc.id} to="/docs" className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <FileText className="h-4 w-4 text-muted-foreground/70 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{doc.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Updated {doc.updated_at?.split("T")[0]}</p>
                    </div>
                  </Link>
                ))}
                {recentDocs.length === 0 && <p className="text-sm text-muted-foreground py-3">No documents yet.</p>}
              </div>
            </CardContent>
          </Card>
        );

      case "activity_feed":
        return <ActivityFeed limit={8} />;

      default:
        return null;
    }
  };

  const today = new Date();
  const dateStr = format(today, "EEEE, MMMM d, yyyy");

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" /> {dateStr}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground text-xs"
            onClick={() => setCustomizerOpen(true)}
          >
            <Settings2 className="h-3.5 w-3.5" /> Customize
          </Button>
        </div>
      </div>

      <OnboardingBanner />

      {/* 2-Column Grid */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={allVisibleIds} strategy={verticalListSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-7 space-y-4">
              {leftWidgets.map((w) => {
                const content = renderWidget(w.id);
                if (!content) return null;
                return <SortableWidget key={w.id} id={w.id}>{content}</SortableWidget>;
              })}
            </div>
            <div className="md:col-span-5 space-y-4">
              {rightWidgets.map((w) => {
                const content = renderWidget(w.id);
                if (!content) return null;
                return <SortableWidget key={w.id} id={w.id}>{content}</SortableWidget>;
              })}
            </div>
          </div>
        </SortableContext>
      </DndContext>

      {/* Form Fill Dialog */}
      <Dialog open={fillOpen} onOpenChange={setFillOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{activeTemplate?.name}</DialogTitle></DialogHeader>
          {activeTemplate?.description && <p className="text-sm text-muted-foreground">{activeTemplate.description}</p>}
          <div className="space-y-3">
            {(activeTemplate?.fields || []).map((field: any) => (
              <div key={field.name}>
                <label className="text-xs text-muted-foreground">
                  {field.name} {field.required && <span className="text-destructive">*</span>}
                </label>
                {field.type === "select" && field.options ? (
                  <Select value={formValues[field.name] || ""} onValueChange={v => setFormValues(prev => ({ ...prev, [field.name]: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {field.options.map((o: string) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : field.type === "textarea" ? (
                  <Textarea
                    value={formValues[field.name] || ""}
                    onChange={e => setFormValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                    className="mt-1 min-h-[60px]"
                  />
                ) : field.type === "date" ? (
                  <Input
                    type="date"
                    value={formValues[field.name] || ""}
                    onChange={e => setFormValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                    className="mt-1"
                  />
                ) : (
                  <Input
                    value={formValues[field.name] || ""}
                    onChange={e => setFormValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                    className="mt-1"
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFillOpen(false)}>Cancel</Button>
            <Button onClick={submitForm} className="gap-1.5"><Send className="h-3.5 w-3.5" /> Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Peek Drawer */}
      <DetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        type="task"
        item={drawerTask}
        onStatusChange={handleTaskStatusChange}
        getName={getName}
      />

      <WidgetCustomizer
        open={customizerOpen}
        onOpenChange={setCustomizerOpen}
        widgets={widgets}
        onSave={savePreferences}
        onReset={resetToDefaults}
      />
    </div>
  );
};

export default Index;
