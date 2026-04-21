import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Lightbulb, Plus, Sparkles, MoreHorizontal, ArrowRight, Trash2, Filter } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

type Idea = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  theme: string | null;
  effort: string | null;
  horizon: string | null;
  priority_score: number | null;
  promoted_to_type: string | null;
  promoted_to_id: string | null;
  created_at: string;
};

const STATUSES = [
  { key: "captured", label: "Captured", color: "bg-blue-500/10 text-blue-700 border-blue-200" },
  { key: "evaluating", label: "Evaluating", color: "bg-amber-500/10 text-amber-700 border-amber-200" },
  { key: "parked", label: "Parked", color: "bg-muted text-muted-foreground border-border" },
  { key: "promoted", label: "Promoted", color: "bg-green-500/10 text-green-700 border-green-200" },
  { key: "killed", label: "Killed", color: "bg-red-500/10 text-red-700 border-red-200" },
];

export function IdeasBacklog() {
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [groupByTheme, setGroupByTheme] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [clustering, setClustering] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Idea | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("ideas").select("*").order("created_at", { ascending: false });
    if (data) setIdeas(data as Idea[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return filter === "all" ? ideas : ideas.filter((i) => i.status === filter);
  }, [ideas, filter]);

  const grouped = useMemo(() => {
    if (!groupByTheme) return { _all: filtered };
    const out: Record<string, Idea[]> = {};
    for (const i of filtered) {
      const k = i.theme?.trim() || "Uncategorized";
      (out[k] = out[k] || []).push(i);
    }
    return out;
  }, [filtered, groupByTheme]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: ideas.length };
    for (const s of STATUSES) c[s.key] = ideas.filter(i => i.status === s.key).length;
    return c;
  }, [ideas]);

  const create = async () => {
    if (!newTitle.trim() || !user) return;
    setBusy(true);
    const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("user_id", user.id).maybeSingle();
    const { error } = await supabase.from("ideas").insert({
      title: newTitle.trim(),
      description: newDesc.trim(),
      created_by: user.id,
      workspace_id: profile?.workspace_id ?? null,
    });
    setBusy(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setNewTitle(""); setNewDesc("");
    load();
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("ideas").update({ status }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else load();
  };

  const cluster = async () => {
    const ids = filtered.map((i) => i.id);
    if (ids.length === 0) { toast({ title: "Nothing to cluster" }); return; }
    setClustering(true);
    try {
      const { data, error } = await supabase.functions.invoke("ideas-cluster", { body: { ideaIds: ids } });
      if (error) throw error;
      toast({ title: "AI clustering complete", description: `Updated ${data?.updated ?? 0} ideas` });
      setGroupByTheme(true);
      load();
    } catch (e: any) {
      toast({ title: "Clustering failed", description: e.message, variant: "destructive" });
    } finally {
      setClustering(false);
    }
  };

  const promote = async (idea: Idea, target: "project" | "goal" | "strategy_item") => {
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("user_id", user.id).maybeSingle();
    const ws = profile?.workspace_id ?? null;
    let newId: string | null = null;
    if (target === "project") {
      const { data, error } = await supabase.from("projects").insert({
        title: idea.title,
        description: idea.description || "",
        created_by: user.id,
        owner_id: user.id,
        status: "not_started",
        priority: "medium",
        workspace_id: ws,
      }).select("id").maybeSingle();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      newId = data?.id ?? null;
    } else if (target === "goal") {
      const now = new Date();
      const q = `Q${Math.floor(now.getMonth() / 3) + 1}`;
      const { data, error } = await supabase.from("goals").insert({
        title: idea.title,
        description: idea.description || "",
        created_by: user.id,
        owner_id: user.id,
        status: "on_track",
        quarter: q,
        year: now.getFullYear(),
        workspace_id: ws,
      }).select("id").maybeSingle();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      newId = data?.id ?? null;
    } else {
      const { data, error } = await supabase.from("strategy_items").insert({
        title: idea.title,
        description: idea.description || "",
        created_by: user.id,
        type: "objective",
        workspace_id: ws,
      }).select("id").maybeSingle();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      newId = data?.id ?? null;
    }
    await supabase.from("ideas").update({
      status: "promoted",
      promoted_to_type: target,
      promoted_to_id: newId,
    }).eq("id", idea.id);
    toast({ title: `Promoted to ${target.replace("_", " ")}`, description: idea.title });
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("ideas").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { setDeleteTarget(null); load(); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" /> Idea Backlog
          </h2>
          <p className="text-xs text-muted-foreground">Dump every idea. AI clusters them. Promote what's ready.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setGroupByTheme(v => !v)}>
            <Filter className="h-3 w-3 mr-1.5" /> {groupByTheme ? "Flat list" : "Group by theme"}
          </Button>
          <Button size="sm" onClick={cluster} disabled={clustering || filtered.length === 0}>
            <Sparkles className="h-3 w-3 mr-1.5" /> {clustering ? "Clustering…" : "AI organize"}
          </Button>
        </div>
      </div>

      {/* Capture */}
      <Card className="bg-amber-500/[0.03] border-amber-500/20">
        <CardContent className="p-4 space-y-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Capture an idea…"
            className="bg-background"
          />
          {newTitle && (
            <Textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Optional context — why does this matter?"
              rows={2}
              className="bg-background text-sm"
            />
          )}
          <div className="flex justify-end">
            <Button size="sm" onClick={create} disabled={!newTitle.trim() || busy}>
              <Plus className="h-3 w-3 mr-1.5" /> Add idea
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" count={counts.all} />
        {STATUSES.map(s => (
          <FilterChip key={s.key} active={filter === s.key} onClick={() => setFilter(s.key)} label={s.label} count={counts[s.key] || 0} />
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          <Lightbulb className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          No ideas yet.
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([theme, items]) => (
            <div key={theme}>
              {groupByTheme && (
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  {theme === "_all" ? "" : theme} <span className="text-muted-foreground/60">· {items.length}</span>
                </h3>
              )}
              <div className="space-y-2">
                {items.map((idea) => {
                  const meta = STATUSES.find(s => s.key === idea.status) || STATUSES[0];
                  return (
                    <div key={idea.id} className="group rounded-lg border border-border bg-card p-3 hover:border-border/80 transition">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn("text-[10px] font-medium uppercase px-2 py-0.5 rounded-full border", meta.color)}>
                              {meta.label}
                            </span>
                            {idea.theme && <Badge variant="secondary" className="text-[10px]">{idea.theme}</Badge>}
                            {idea.effort && <Badge variant="outline" className="text-[10px] uppercase">{idea.effort}</Badge>}
                            {idea.horizon && <span className="text-[10px] text-muted-foreground">{idea.horizon}</span>}
                          </div>
                          <p className="text-sm text-foreground mt-1.5">{idea.title}</p>
                          {idea.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{idea.description}</p>}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Promote to…</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => promote(idea, "project")}>
                              <ArrowRight className="h-3 w-3 mr-2" /> Project
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => promote(idea, "goal")}>
                              <ArrowRight className="h-3 w-3 mr-2" /> Quarterly Goal
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => promote(idea, "strategy_item")}>
                              <ArrowRight className="h-3 w-3 mr-2" /> Strategy Item
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Status</DropdownMenuLabel>
                            {STATUSES.map(s => (
                              <DropdownMenuItem key={s.key} onClick={() => setStatus(idea.id, s.key)} disabled={idea.status === s.key}>
                                {s.label}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(idea)}>
                              <Trash2 className="h-3 w-3 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        entityLabel="idea"
        entityName={deleteTarget?.title}
        requireType={false}
        onConfirm={() => deleteTarget && remove(deleteTarget.id)}
      />
    </div>
  );
}

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-full text-[11px] font-medium transition flex items-center gap-1.5",
        active ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"
      )}
    >
      {label} <span className="text-[10px] opacity-70">{count}</span>
    </button>
  );
}
