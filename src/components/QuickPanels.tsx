import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  StickyNote, Sparkles, Plus, ArrowRight, Loader2, Pin, PinOff, Share2,
  ChevronLeft, Trash2, ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@/hooks/use-toast";
import RichTextEditor from "@/components/RichTextEditor";
import AiProjectPeek from "@/components/ai-workshop/AiProjectPeek";
import { NoteShareDialog } from "@/components/notes/NoteShareDialog";
import { cn } from "@/lib/utils";

const sb = supabase as any;

function relTime(iso: string) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return ""; }
}

// ── Notes Quick Panel ─────────────────────────────────────────────────────────

type Note = {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  notebook_id: string | null;
  is_public?: boolean;
  share_token?: string | null;
  updated_at: string;
};

type Notebook = { id: string; name: string; color: string };

export function NotesQuickPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [draftTitle, setDraftTitle] = useState<string>("");
  const [shareOpen, setShareOpen] = useState(false);
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [notesRes, nbRes] = await Promise.all([
      sb.from("notes")
        .select("id, title, content, pinned, notebook_id, is_public, share_token, updated_at")
        .eq("user_id", user.id)
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(40),
      sb.from("notebooks").select("id, name, color").eq("user_id", user.id).order("name"),
    ]);
    setNotes((notesRes.data ?? []) as Note[]);
    setNotebooks((nbRes.data ?? []) as Notebook[]);
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open, user]);

  useEffect(() => {
    if (!activeId) { setDraft(""); setDraftTitle(""); return; }
    const n = notes.find((x) => x.id === activeId);
    if (n) { setDraft(n.content || ""); setDraftTitle(n.title || ""); }
  }, [activeId, notes.length]);

  const activeNote = activeId ? notes.find((n) => n.id === activeId) : null;
  const activeNotebook = activeNote?.notebook_id ? notebooks.find((nb) => nb.id === activeNote.notebook_id) : null;

  const saveDebounced = (patch: Partial<Note>) => {
    if (!activeId) return;
    if (saveTimer) clearTimeout(saveTimer);
    const t = setTimeout(async () => {
      await sb.from("notes").update(patch).eq("id", activeId);
      load();
    }, 500);
    setSaveTimer(t);
  };

  const saveNow = async (patch: Partial<Note>) => {
    if (!activeId) return;
    await sb.from("notes").update(patch).eq("id", activeId);
    load();
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

  const togglePin = async () => {
    if (!activeNote) return;
    await saveNow({ pinned: !activeNote.pinned });
    toast({ title: activeNote.pinned ? "Unpinned" : "Pinned" });
  };

  const deleteActive = async () => {
    if (!activeId) return;
    if (!confirm("Delete this note?")) return;
    await sb.from("notes").delete().eq("id", activeId);
    setActiveId(null);
    load();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col p-0">
        <SheetHeader className="px-5 py-3 border-b border-border/40 flex flex-row items-center justify-between space-y-0 shrink-0">
          {activeId ? (
            <button
              onClick={() => setActiveId(null)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> All notes
            </button>
          ) : (
            <SheetTitle className="flex items-center gap-2 text-base">
              <StickyNote className="h-4 w-4 text-amber-500" /> Notes
            </SheetTitle>
          )}

          <div className="flex items-center gap-1">
            {activeId ? (
              <>
                <button onClick={togglePin} className="h-8 w-8 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted" title={activeNote?.pinned ? "Unpin" : "Pin"}>
                  {activeNote?.pinned ? <Pin className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> : <PinOff className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => setShareOpen(true)} className="h-8 w-8 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted" title="Share">
                  <Share2 className="h-3.5 w-3.5" />
                </button>
                <button onClick={deleteActive} className="h-8 w-8 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <Link to={`/notes?id=${activeId}`} onClick={() => onOpenChange(false)} className="h-8 w-8 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted" title="Open in full page">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </>
            ) : (
              <>
                <button onClick={createNote} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-primary text-primary-foreground">
                  <Plus className="h-3 w-3" /> New
                </button>
                <Link to="/notes" onClick={() => onOpenChange(false)} className="text-[11px] text-primary hover:underline px-2 py-1">
                  Full page →
                </Link>
              </>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 px-5 py-6 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading…
            </div>
          ) : activeId && activeNote ? (
            <div className="px-6 py-5 space-y-4">
              {/* Notebook + metadata */}
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <select
                  value={activeNote.notebook_id ?? ""}
                  onChange={(e) => saveNow({ notebook_id: e.target.value || null })}
                  className="bg-transparent border-none outline-none cursor-pointer hover:text-foreground"
                >
                  <option value="">Unfiled</option>
                  {notebooks.map((nb) => (
                    <option key={nb.id} value={nb.id}>{nb.name}</option>
                  ))}
                </select>
                {activeNotebook && (
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: `hsl(${activeNotebook.color})` }} />
                )}
                <span className="text-muted-foreground/50">· {relTime(activeNote.updated_at)}</span>
                {activeNote.is_public && (
                  <span className="text-emerald-600 dark:text-emerald-400 text-[10px] uppercase tracking-wider">· Shared</span>
                )}
              </div>

              <input
                value={draftTitle}
                onChange={(e) => { setDraftTitle(e.target.value); saveDebounced({ title: e.target.value }); }}
                placeholder="Untitled Note"
                className="w-full text-2xl font-bold bg-transparent outline-none placeholder:text-muted-foreground/30 leading-tight"
              />

              {/* Match the actual /notes page: borderless, slash-commands, bubble menu on selection */}
              <RichTextEditor
                key={activeId}
                content={draft}
                onChange={(html) => { setDraft(html); saveDebounced({ content: html }); }}
                placeholder="Start writing…"
                borderless
              />
            </div>
          ) : notes.length === 0 ? (
            <div className="px-5 py-12 text-center space-y-2">
              <StickyNote className="h-6 w-6 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No notes yet.</p>
              <button onClick={createNote} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                <Plus className="h-3 w-3" /> Create your first note
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-border/30">
              {notes.map((n) => {
                const nb = n.notebook_id ? notebooks.find((x) => x.id === n.notebook_id) : null;
                const preview = (n.content || "").replace(/<[^>]*>/g, "").slice(0, 90);
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => setActiveId(n.id)}
                      className="w-full text-left px-5 py-3 hover:bg-muted/40 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        {nb && <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: `hsl(${nb.color})` }} />}
                        <span className="text-sm font-medium text-foreground truncate flex-1">{n.title || "Untitled Note"}</span>
                        {n.pinned && <Pin className="h-3 w-3 text-amber-500 shrink-0" />}
                        <span className="text-[10px] text-muted-foreground/60 shrink-0 group-hover:text-muted-foreground">{relTime(n.updated_at)}</span>
                      </div>
                      {preview && (
                        <p className="text-[11px] text-muted-foreground/70 line-clamp-1 mt-0.5 ml-3.5">{preview}</p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {activeNote && (
          <NoteShareDialog
            open={shareOpen}
            onOpenChange={setShareOpen}
            noteId={activeNote.id}
            initialIsPublic={!!activeNote.is_public}
            initialShareToken={activeNote.share_token ?? null}
            initialSharedMemberIds={[]}
            onUpdated={() => load()}
          />
        )}
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

export function AiWorkshopQuickPanel({
  open, onOpenChange, peekProjectId, setPeekProjectId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  peekProjectId: string | null;
  setPeekProjectId: (id: string | null) => void;
}) {
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
    <Sheet open={open} onOpenChange={(o) => { if (!o) setPeekProjectId(null); onOpenChange(o); }}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col p-0">
        <SheetHeader className="px-5 py-3 border-b border-border/40 flex flex-row items-center justify-between space-y-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> AI Workshop
          </SheetTitle>
          <Link to="/ai-workshop" onClick={() => onOpenChange(false)} className="text-[11px] text-primary hover:underline px-2 py-1">
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
              <Link to="/ai-workshop" onClick={() => onOpenChange(false)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
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
                        <button
                          onClick={() => {
                            // Open the same AiProjectPeek the workshop page uses, inline. Close my list panel.
                            setPeekProjectId(p.id);
                            onOpenChange(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/40 transition-colors"
                        >
                          <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                          {p.description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{p.description}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">{relTime(p.updated_at)}</p>
                        </button>
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

// ── Bottom-left floating dock ─────────────────────────────────────────────────

export function QuickPanelsDock() {
  const [notesOpen, setNotesOpen] = useState(false);
  const [workshopOpen, setWorkshopOpen] = useState(false);
  // Project peek state lives at the dock level so it survives the workshop slideover closing
  const [peekProjectId, setPeekProjectId] = useState<string | null>(null);

  return (
    <>
      {/* Floating dock — stacked above the Albus FAB at bottom-right */}
      <div className="fixed bottom-20 right-6 z-40 flex flex-col gap-2">
        <button
          onClick={() => setNotesOpen(true)}
          className="h-10 w-10 rounded-full bg-card/95 backdrop-blur-md border border-border/60 shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center text-muted-foreground hover:text-amber-500"
          title="Quick Notes"
        >
          <StickyNote className="h-4 w-4" />
        </button>
        <button
          onClick={() => setWorkshopOpen(true)}
          className="h-10 w-10 rounded-full bg-card/95 backdrop-blur-md border border-border/60 shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center text-muted-foreground hover:text-primary"
          title="AI Workshop"
        >
          <Sparkles className="h-4 w-4" />
        </button>
      </div>

      <NotesQuickPanel open={notesOpen} onOpenChange={setNotesOpen} />
      <AiWorkshopQuickPanel
        open={workshopOpen}
        onOpenChange={setWorkshopOpen}
        peekProjectId={peekProjectId}
        setPeekProjectId={setPeekProjectId}
      />
      {/* Real AiProjectPeek — renders when a project is clicked from the slideover.
         Same experience as opening from the AI Workshop page. */}
      <AiProjectPeek
        projectId={peekProjectId}
        onClose={() => setPeekProjectId(null)}
        onChange={() => { /* no parent list to refresh here */ }}
      />
    </>
  );
}
