import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Briefcase, Building2, ExternalLink, CheckSquare, Folder } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatusPill, PriorityPill } from "@/components/primitives";
import TaskPeek from "@/components/mention-peek/peeks/TaskPeek";

interface Props { id: string; open: boolean; onClose: () => void; }

interface WorkTask { id: string; title: string; status: string; priority: string | null; }
interface WorkProject { id: string; title: string; status: string; priority: string | null; }

// "Active" mirrors the convention used everywhere else this kind of workload
// rollup happens (DepartmentPeopleTab) — terminal states drop off the list.
const isActiveTask = (s: string) => s !== "done" && s !== "archived";
const isActiveProject = (s: string) => s !== "completed" && s !== "archived";

export default function PersonPeek({ id, open, onClose }: Props) {
  const navigate = useNavigate();
  const [p, setP] = useState<any>(null);
  const [dept, setDept] = useState<string | null>(null);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [peekTaskId, setPeekTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !id) return;
    let cancelled = false;
    (async () => {
      const [{ data }, { data: t }, { data: pr }] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", id).maybeSingle(),
        supabase.from("tasks").select("id,title,status,priority").eq("assigned_to", id).order("due_date"),
        supabase.from("projects").select("id,title,status,priority").eq("owner_id", id).order("due_date"),
      ]);
      if (cancelled) return;
      setP(data);
      setTasks((t || []).filter((x: WorkTask) => isActiveTask(x.status)));
      setProjects((pr || []).filter((x: WorkProject) => isActiveProject(x.status)));
      if (data?.department_id) {
        const { data: d } = await supabase.from("departments").select("name").eq("id", data.department_id).maybeSingle();
        if (!cancelled) setDept(d?.name ?? null);
      } else setDept(null);
    })();
    return () => { cancelled = true; };
  }, [id, open]);

  const initials = (p?.full_name || "U").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-8 pb-6">
            <Avatar className="h-20 w-20 mb-4 ring-2 ring-background shadow-lg">
              {p?.avatar_url && <AvatarImage src={p.avatar_url} />}
              <AvatarFallback className="bg-primary/20 text-primary text-lg font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <SheetHeader className="space-y-1 text-left">
              <SheetTitle className="text-2xl">{p?.full_name || "Loading..."}</SheetTitle>
              {p?.title && <p className="text-sm text-muted-foreground">{p.title}</p>}
            </SheetHeader>
            {p?.availability_status && (
              <Badge variant="secondary" className="mt-3 capitalize">{p.availability_status}</Badge>
            )}
          </div>

          <div className="px-6 py-5 space-y-3">
            {dept && (
              <div className="flex items-center gap-3 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{dept}</span>
              </div>
            )}
            {p?.email && (
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`mailto:${p.email}`} className="hover:underline truncate">{p.email}</a>
              </div>
            )}
            {p?.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`tel:${p.phone}`} className="hover:underline">{p.phone}</a>
              </div>
            )}
            {p?.bio && (
              <div className="pt-3 border-t border-border/40">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">About</p>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{p.bio}</p>
              </div>
            )}
            {p?.skills && p.skills.length > 0 && (
              <div className="pt-3 border-t border-border/40">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" /> Skills
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {p.skills.map((s: string) => (
                    <Badge key={s} variant="secondary" className="text-[11px] rounded-full">{s}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Work — the person lens: what they're actually doing right now. */}
            {(tasks.length > 0 || projects.length > 0) && (
              <div className="pt-3 border-t border-border/40 space-y-4">
                {tasks.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <CheckSquare className="h-3.5 w-3.5" /> Active tasks
                      <span className="text-muted-foreground/60 font-normal">({tasks.length})</span>
                    </p>
                    <div className="space-y-1">
                      {tasks.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setPeekTaskId(t.id)}
                          className="w-full flex items-center gap-2 text-left text-sm rounded-lg px-2 py-1.5 -mx-2 hover:bg-accent/40 transition-colors"
                        >
                          <span className="flex-1 min-w-0 truncate">{t.title}</span>
                          {t.priority && <PriorityPill value={t.priority} size="sm" onChange={() => {}} />}
                          <StatusPill kind="task" value={t.status} size="sm" onChange={() => {}} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {projects.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Folder className="h-3.5 w-3.5" /> Active projects
                      <span className="text-muted-foreground/60 font-normal">({projects.length})</span>
                    </p>
                    <div className="space-y-1">
                      {projects.map((pr) => (
                        <button
                          key={pr.id}
                          onClick={() => { onClose(); navigate(`/projects/${pr.id}`); }}
                          className="w-full flex items-center gap-2 text-left text-sm rounded-lg px-2 py-1.5 -mx-2 hover:bg-accent/40 transition-colors"
                        >
                          <span className="flex-1 min-w-0 truncate">{pr.title}</span>
                          <StatusPill kind="project" value={pr.status} size="sm" onChange={() => {}} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="pt-4 border-t border-border/40">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => { onClose(); navigate(`/people?u=${id}`); }}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open full profile
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {peekTaskId && (
        <TaskPeek id={peekTaskId} open={!!peekTaskId} onClose={() => setPeekTaskId(null)} />
      )}
    </>
  );
}
