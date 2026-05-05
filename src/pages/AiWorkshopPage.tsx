import { useEffect, useState, useMemo } from "react";
import { Plus, LayoutGrid, List as ListIcon, Sparkles, ExternalLink, Github, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { AI_STAGES, type AiProject } from "@/components/ai-workshop/types";
import NewAiProjectDialog from "@/components/ai-workshop/NewAiProjectDialog";
import AiProjectPeek from "@/components/ai-workshop/AiProjectPeek";
import AiToolsManager from "@/components/ai-workshop/AiToolsManager";

export default function AiWorkshopPage() {
  const [projects, setProjects] = useState<AiProject[]>([]);
  const [view, setView] = useState<"board" | "list">("board");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase.from("ai_projects" as any).select("*").order("updated_at", { ascending: false }) as any);
    setProjects((data as AiProject[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? projects.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.description ?? "").toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q)) ||
      p.platforms.some((t) => t.toLowerCase().includes(q))
    ) : projects;
  }, [projects, search]);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> AI Workshop
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track every AI project — idea, build, live, archived.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="h-9 w-56" />
          <div className="flex border rounded-md p-0.5">
            <Button variant={view === "board" ? "secondary" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setView("board")}><LayoutGrid className="h-3.5 w-3.5" /></Button>
            <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setView("list")}><ListIcon className="h-3.5 w-3.5" /></Button>
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9" title="Tool stack" onClick={() => setToolsOpen(true)}>
            <Wrench className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> New project</Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Sparkles className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <h3 className="text-base font-medium">No AI projects yet</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Track your first idea, prompt, or shipped agent.</p>
          <Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> New project</Button>
        </Card>
      ) : view === "board" ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {AI_STAGES.map((stage) => {
            const items = filtered.filter((p) => p.stage === stage.id);
            return (
              <div key={stage.id} className="min-w-[280px] w-[280px] flex-shrink-0">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={stage.color}>{stage.label}</Badge>
                    <span className="text-xs text-muted-foreground">{items.length}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {items.map((p) => (
                    <Card key={p.id} onClick={() => setOpenId(p.id)} className="p-3 cursor-pointer hover:shadow-md transition-all hover:border-primary/30">
                      {p.cover_url && <img src={p.cover_url} alt="" className="w-full h-20 object-cover rounded-md mb-2" />}
                      <p className="text-sm font-medium line-clamp-1">{p.name}</p>
                      {p.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{p.description}</p>}
                      {(p.platforms.length > 0 || p.tags.length > 0) && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {p.platforms.slice(0, 3).map((t) => <Badge key={t} variant="secondary" className="text-[10px] h-4 px-1.5">{t}</Badge>)}
                          {p.tags.slice(0, 2).map((t) => <Badge key={t} variant="outline" className="text-[10px] h-4 px-1.5">#{t}</Badge>)}
                        </div>
                      )}
                      {(p.live_url || p.repo_url) && (
                        <div className="flex gap-2 mt-2 text-muted-foreground">
                          {p.live_url && <ExternalLink className="h-3 w-3" />}
                          {p.repo_url && <Github className="h-3 w-3" />}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="divide-y">
            {filtered.map((p) => {
              const stage = AI_STAGES.find((s) => s.id === p.stage);
              return (
                <button key={p.id} onClick={() => setOpenId(p.id)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{p.name}</span>
                      {stage && <Badge variant="outline" className={`${stage.color} text-[10px]`}>{stage.label}</Badge>}
                    </div>
                    {p.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{p.description}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {p.platforms.slice(0, 2).map((t) => <Badge key={t} variant="secondary" className="text-[10px] h-4 px-1.5">{t}</Badge>)}
                  </div>
                  <span className="text-[10px] text-muted-foreground w-20 text-right">{new Date(p.updated_at).toLocaleDateString()}</span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <NewAiProjectDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={(id) => { load(); setOpenId(id); }} />
      <AiProjectPeek projectId={openId} onClose={() => setOpenId(null)} onChange={load} />
      <AiToolsManager open={toolsOpen} onOpenChange={setToolsOpen} />
    </div>
  );
}
