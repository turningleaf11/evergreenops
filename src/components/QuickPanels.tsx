import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StickyNote, Sparkles, Plus, ArrowRight, Loader2, Pin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@/hooks/use-toast";
import RichTextEditor from "@/components/RichTextEditor";
import { cn } from "@/lib/utils";

const sb = supabase as any;

function relTime(iso: string) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return ""; }
}

// ── Notes Quick Panel ─────────────────────────────────────────────────────────

type Note = { id: string; title: string; content: string; pinned: boolean; updated_at: string };

export function NotesQuickPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [draftTitle, setDraftTitle] = useState<string>("");
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await sb
      .from("notes")
      .select("id, title, content, pinned, updated_at")
      .eq("user_id", user.id)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(20);
    setNotes(((data ?? []) as Note[]));
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open, user]);

  useEffect(() => {
    if (!activeId) { setDraft(""); setDraftTitle(""); return; }
    const n = notes.find((x) => x.id === activeId);
    if (n) { setDraft(n.content || ""); setDraftTitle(n.title || ""); }
  }, [activeId, notes.length]);

  const saveDebounced = (patch: Partial<Note>) => {
    if (!activeId) return;
    if (saveTimer) clearTimeout(saveTimer);
    const t = setTimeout(async () => {
      await sb.from("notes").update(patch).eq("id", activeId);
      load();
    }, 600);
    setSaveTimer(t);
  };

  const createNote = async () => {
    if (!user) return;
    const { data, error } = await sb
      .from("notes")
      .insert({ user_id: user.id, title: "Untitled Note", content: "" })
      .select()
      .single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await load();
    setActiveId(data.id);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col p-0">
        <SheetHeader className="px-5 py-3 border-b border-border/40 flex flex-row items-center justify-between space-y-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <StickyNote className="h-4 w-4 text-amber-500" />
            {activeId ? "Note" : "Quick Notes"}
          </SheetTitle>
          <div className="flex items-center gap-1.5">
            {activeId ? (
              <button onClick={() => setActiveId(null)} className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md">
                ← All notes
              </button>
            ) : (
              <button onClick={createNote} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-primary text-primary-foreground">
                <Plus className="h-3 w-3" /> New
              </button>
            )}
            <Link to="/notes" className="text-[11px] text-primary hover:underline px-2 py-1">
              Full page →
            </Link>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 px-5 py-6 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading…
            </div>
          ) : activeId ? (
            <div className="px-5 py-4 space-y-3">
              <input
                value={draftTitle}
                onChange={(e) => { setDraftTitle(e.target.value); saveDebounced({ title: e.target.value }); }}
                placeholder="Title"
                className="w-full text-base font-semibold bg-transparent outline-none border-b border-border/30 pb-2 placeholder:text-muted-foreground/40"
              />
              <RichTextEditor
                content={draft}
                onChange={(html) => { setDraft(html); saveDebounced({ content: html }); }}
                placeholder="Start typing…"
              />
            </div>
          ) : notes.length === 0 ? (
            <div className="px-5 py-8 text-center space-y-2">
              <StickyNote className="h-6 w-6 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No notes yet.</p>
              <button onClick={createNote} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                <Plus className="h-3 w-3" /> Create your first note
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {notes.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => setActiveId(n.id)}
                    className="w-full text-left px-5 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate flex-1">{n.title || "Untitled Note"}</span>
                      {n.pinned && <Pin className="h-3 w-3 text-amber-500 shrink-0" />}
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">{relTime(n.updated_at)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── AI Workshop Quick Panel ───────────────────────────────────────────────────

type AiProj = { id: string; name: string; description: string | null; stage: string; updated_at: string };

const STAGE_TONE: Record<string, string> = {
  idea: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  building: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  live: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  archived: "bg-muted text-muted-foreground",
};

export function AiWorkshopQuickPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [projects, setProjects] = useState<AiProj[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await sb
      .from("ai_projects")
      .select("id, name, description, stage, updated_at")
      .order("updated_at", { ascending: false })
      .limit(30);
    setProjects(((data ?? []) as AiProj[]));
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open]);

  const grouped = projects.reduce<Record<string, AiProj[]>>((acc, p) => {
    (acc[p.stage] ??= []).push(p);
    return acc;
  }, {});
  const stages = ["idea", "building", "live", "archived"];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col p-0">
        <SheetHeader className="px-5 py-3 border-b border-border/40 flex flex-row items-center justify-between space-y-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> AI Workshop
          </SheetTitle>
          <Link to="/ai-workshop" className="text-[11px] text-primary hover:underline px-2 py-1">
            Full page →
          </Link>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading…
            </div>
          ) : projects.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <Sparkles className="h-6 w-6 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No AI projects yet.</p>
              <Link to="/ai-workshop" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Create one <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            stages.map((stage) => {
              const items = grouped[stage];
              if (!items?.length) return null;
              return (
                <div key={stage}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className={cn("text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full", STAGE_TONE[stage] ?? STAGE_TONE.archived)}>
                      {stage}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">{items.length}</span>
                  </div>
                  <ul className="space-y-1">
                    {items.map((p) => (
                      <li key={p.id}>
                        <Link
                          to={`/ai-workshop?project=${p.id}`}
                          onClick={() => onOpenChange(false)}
                          className="block px-3 py-2 rounded-md hover:bg-muted/40 transition-colors"
                        >
                          <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                          {p.description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{p.description}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">{relTime(p.updated_at)}</p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Header dock — the icons that summon the panels ────────────────────────────

export function QuickPanelsDock() {
  const [notesOpen, setNotesOpen] = useState(false);
  const [workshopOpen, setWorkshopOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setNotesOpen(true)}
        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Quick Notes"
      >
        <StickyNote className="h-4 w-4" />
      </button>
      <button
        onClick={() => setWorkshopOpen(true)}
        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="AI Workshop"
      >
        <Sparkles className="h-4 w-4" />
      </button>

      <NotesQuickPanel open={notesOpen} onOpenChange={setNotesOpen} />
      <AiWorkshopQuickPanel open={workshopOpen} onOpenChange={setWorkshopOpen} />
    </>
  );
}
