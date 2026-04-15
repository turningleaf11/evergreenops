import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { Pin, FileText, ArrowRight, FileSpreadsheet, Send, Clock, CheckCircle2, XCircle, Play, Square, ListTodo, Star, X, Plus, MessageSquare, Settings2 } from "lucide-react";
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
import { format, parseISO, differenceInMinutes } from "date-fns";
import { WidgetCustomizer } from "@/components/home/WidgetCustomizer";
import { FeedCarousel } from "@/components/home/FeedCarousel";
import { useWidgetPreferences } from "@/hooks/useWidgetPreferences";
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

// Sortable widget wrapper
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
        className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing bg-card border rounded-md p-0.5 shadow-sm"
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
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

  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [recentDocs, setRecentDocs] = useState<any[]>([]);
  const [formTemplates, setFormTemplates] = useState<any[]>([]);
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);
  const [fillOpen, setFillOpen] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<any>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});

  // Time clock state
  const [timeClockEnabled, setTimeClockEnabled] = useState(false);
  const [activeClockEntry, setActiveClockEntry] = useState<any>(null);
  const [elapsedTime, setElapsedTime] = useState("");

  // New widgets state
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [addingFav, setAddingFav] = useState(false);
  const [favLabel, setFavLabel] = useState("");
  const [favUrl, setFavUrl] = useState("");

  const visibleDepartments = isAdmin
    ? departments
    : departments.filter((d) => d.id === profile?.department_id);

  useEffect(() => {
    const fetchAll = async () => {
      const [annRes, docRes, formRes, subRes] = await Promise.all([
        supabase.from("announcements").select("*").eq("pinned", true).limit(5),
        supabase.from("documents").select("id, title, author_name, updated_at, tags, visibility, shared_with").order("updated_at", { ascending: false }).limit(20),
        supabase.from("form_templates").select("*").eq("is_active", true).order("name"),
        user ? supabase.from("form_submissions").select("*").eq("submitted_by", user.id).order("created_at", { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
      ]);
      if (annRes.data) setAnnouncements(annRes.data);
      if (formRes.data) setFormTemplates(formRes.data);
      if (subRes.data) setMySubmissions(subRes.data as any[]);
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

      // Time clock
      if (user) {
        const { data: p } = await supabase.from("profiles").select("time_clock_enabled").eq("user_id", user.id).single();
        const enabled = p?.time_clock_enabled || false;
        setTimeClockEnabled(enabled);
        if (enabled) {
          const { data: entries } = await supabase.from("time_entries").select("*").eq("user_id", user.id).is("clock_out", null).limit(1);
          if (entries && entries.length > 0) setActiveClockEntry(entries[0]);
        }
      }

      // My Tasks
      if (user) {
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id, title, status, due_date, priority")
          .eq("assigned_to", user.id)
          .neq("status", "done")
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(5);
        if (tasks) setMyTasks(tasks);
      }

      // Quick Links
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

  // Elapsed time ticker
  useEffect(() => {
    if (!activeClockEntry) { setElapsedTime(""); return; }
    const tick = () => {
      const mins = differenceInMinutes(new Date(), parseISO(activeClockEntry.clock_in));
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      setElapsedTime(`${h}h ${m}m`);
    };
    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, [activeClockEntry]);

  const punchIn = async () => {
    if (!user) return;
    const { error } = await supabase.from("time_entries").insert({ user_id: user.id, clock_in: new Date().toISOString() });
    if (error) { toast.error(error.message); return; }
    toast.success("Clocked in!");
    const { data } = await supabase.from("time_entries").select("*").eq("user_id", user.id).is("clock_out", null).limit(1);
    if (data && data.length > 0) setActiveClockEntry(data[0]);
  };

  const punchOut = async () => {
    if (!activeClockEntry) return;
    const { error } = await supabase.from("time_entries").update({ clock_out: new Date().toISOString() }).eq("id", activeClockEntry.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Clocked out!");
    setActiveClockEntry(null);
  };

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

  const statusIcon: Record<string, React.ReactNode> = {
    pending: <Clock className="h-3.5 w-3.5 text-amber-500" />,
    approved: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
    denied: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  };

  // DnD sensors for main layout
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = widgets.findIndex((w) => w.id === active.id);
    const newIdx = widgets.findIndex((w) => w.id === over.id);
    const reordered = arrayMove(widgets, oldIdx, newIdx).map((w, i) => ({ ...w, sort_order: i }));
    savePreferences(reordered);
  };

  const visibleWidgets = widgets.filter((w) => w.visible);

  // Widget renderers
  const renderWidget = (widgetId: string) => {
    switch (widgetId) {
      case "time_clock":
        if (!timeClockEnabled) return null;
        return (
          <Card className={`border-l-4 ${activeClockEntry ? "border-l-green-500" : "border-l-amber-500"}`}>
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className={`h-5 w-5 ${activeClockEntry ? "text-green-500" : "text-amber-500"}`} />
                <div>
                  <p className="font-medium text-sm">
                    {activeClockEntry ? `Clocked In — ${elapsedTime}` : "Time Clock"}
                  </p>
                  {activeClockEntry && (
                    <p className="text-xs text-muted-foreground">
                      Since {format(parseISO(activeClockEntry.clock_in), "h:mm a")}
                    </p>
                  )}
                </div>
              </div>
              {activeClockEntry ? (
                <Button size="sm" variant="destructive" onClick={punchOut} className="gap-1.5">
                  <Square className="h-3 w-3" /> Clock Out
                </Button>
              ) : (
                <Button size="sm" onClick={punchIn} className="gap-1.5">
                  <Play className="h-3 w-3" /> Clock In
                </Button>
              )}
            </CardContent>
          </Card>
        );

      case "announcements":
        if (announcements.length === 0) return null;
        return (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Pinned Announcements</h2>
            {announcements.map((a) => (
              <Card key={a.id}>
                <CardContent className="py-3 px-4 flex items-start gap-2">
                  <Pin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div><p className="font-medium text-sm">{a.title}</p><p className="text-xs text-muted-foreground mt-0.5">{a.content}</p></div>
                </CardContent>
              </Card>
            ))}
          </section>
        );

      case "departments":
        return (
          <section>
            <h2 className="text-lg font-semibold mb-3">Departments</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {visibleDepartments.map((dept) => {
                const Icon = getDeptIcon(dept.icon);
                return (
                  <Link key={dept.id} to={`/department/${dept.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: `hsl(${dept.color} / 0.1)`, color: `hsl(${dept.color})` }}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm">{dept.name}</p>
                            <p className="text-xs text-muted-foreground">{dept.description || "Department"}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        );

      case "forms":
        if (formTemplates.length === 0) return null;
        return (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" /> Forms & Requests
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {formTemplates.map((t) => (
                <Card key={t.id} className="hover:border-primary/40 transition-colors cursor-pointer" onClick={() => openForm(t)}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{t.name}</p>
                        {t.description && <p className="text-[10px] text-muted-foreground truncate">{t.description}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {mySubmissions.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Recent Submissions</p>
                {mySubmissions.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 text-xs py-1">
                    {statusIcon[s.status]}
                    <span>{formTemplates.find((t: any) => t.id === s.template_id)?.name || "Form"}</span>
                    <Badge variant="secondary" className="text-[10px] capitalize ml-auto">{s.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </section>
        );

      case "my_tasks":
        return (
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <h2 className="text-base font-semibold flex items-center gap-2"><ListTodo className="h-4 w-4" /> My Tasks</h2>
                <Link to="/execution" className="text-xs text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
              </div>
              <div className="px-4 pb-4 space-y-1">
                {myTasks.length === 0 && <p className="text-sm text-muted-foreground py-3">No tasks assigned to you.</p>}
                {myTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => navigate(`/execution/task/${task.id}`)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                  >
                    <span className={`h-2 w-2 rounded-full shrink-0 ${statusColors[task.status] || "bg-muted-foreground"}`} />
                    <span className="text-sm font-medium truncate flex-1">{task.title}</span>
                    {task.due_date && (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {format(parseISO(task.due_date), "MMM d")}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px] capitalize shrink-0">{task.priority}</Badge>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        );

      case "quick_links":
        return (
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <h2 className="text-base font-semibold flex items-center gap-2"><Star className="h-4 w-4" /> Quick Links</h2>
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
        return <FeedCarousel />;

      case "reminders":
        return <RemindersWidget />;

      case "recent_docs":
        return (
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <h2 className="text-base font-semibold">Recent Docs</h2>
                <Link to="/docs" className="text-xs text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
              </div>
              <div className="px-4 pb-4 space-y-2">
                {recentDocs.map((doc) => (
                  <div key={doc.id} className="flex items-start gap-3 p-2 rounded hover:bg-muted/50 transition-colors">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{doc.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Updated {doc.updated_at?.split("T")[0]}</p>
                    </div>
                  </div>
                ))}
                {recentDocs.length === 0 && <p className="text-sm text-muted-foreground">No documents yet.</p>}
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

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-base text-muted-foreground">Here's what's happening in your workspace.</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={() => setCustomizerOpen(true)}
        >
          <Settings2 className="h-4 w-4" /> Customize
        </Button>
      </div>

      <OnboardingBanner />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleWidgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-6">
            {visibleWidgets.map((w) => {
              const content = renderWidget(w.id);
              if (!content) return null;
              return (
                <SortableWidget key={w.id} id={w.id}>
                  {content}
                </SortableWidget>
              );
            })}
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
