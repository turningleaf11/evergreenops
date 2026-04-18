import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, FileText, ArrowRight, Trash2, BookOpen, MoreHorizontal, Pencil, X, Share2, Globe, Pin, PinOff, Palette } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import RichTextEditor from "@/components/RichTextEditor";
import { NoteShareDialog } from "@/components/notes/NoteShareDialog";

interface Note {
  id: string;
  title: string;
  content: string;
  folder: string | null;
  notebook_id: string | null;
  pinned: boolean;
  converted_doc_id: string | null;
  created_at: string;
  updated_at: string;
  is_public?: boolean;
  share_token?: string | null;
  shared_with?: any;
}

interface Notebook {
  id: string;
  name: string;
  color: string;
}

const NOTEBOOK_COLORS = [
  "220 65% 55%", // blue
  "142 71% 45%", // green
  "20 90% 55%",  // orange
  "350 89% 60%", // pink
  "262 83% 58%", // purple
  "180 70% 45%", // teal
  "48 96% 53%",  // yellow
  "220 15% 45%", // slate
];

function fmtDate(d: string) {
  const date = new Date(d);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "2-digit" });
}

export default function NotesPage() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const [notes, setNotes] = useState<Note[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<{ id: string; updates: Partial<Note> } | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertTitle, setConvertTitle] = useState("");
  const [shareOpen, setShareOpen] = useState(false);

  // Sidebar state
  const [activeView, setActiveView] = useState<"all" | "pinned" | string>("all"); // string = notebook id
  const [expandedNotebooks, setExpandedNotebooks] = useState<Set<string>>(new Set());
  const [creatingNotebook, setCreatingNotebook] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState("");
  const [renamingNotebook, setRenamingNotebook] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Drag-and-drop state
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null); // notebook id, "unfiled", or null

  const fetchNotes = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notes")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (data) setNotes(data as any[] as Note[]);
  }, [user]);

  const fetchNotebooks = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("note_folders").select("id, name, color").eq("user_id", user.id).order("sort_order");
    if (data) setNotebooks(data as Notebook[]);
  }, [user]);

  useEffect(() => { fetchNotes(); fetchNotebooks(); }, [fetchNotes, fetchNotebooks]);

  // Handle instant-create from GlobalCreateMenu
  useEffect(() => {
    const state = location.state as { selectNoteId?: string } | null;
    if (state?.selectNoteId && notes.length > 0) {
      const note = notes.find(n => n.id === state.selectNoteId);
      if (note) selectNote(note);
      window.history.replaceState({}, document.title);
    }
  }, [location.state, notes]);

  const pinnedNotes = useMemo(() => notes.filter(n => n.pinned), [notes]);
  const unfiledNotes = useMemo(() => notes.filter(n => !n.notebook_id), [notes]);
  const notesByNotebook = useMemo(() => {
    const map: Record<string, Note[]> = {};
    notes.forEach(n => {
      if (n.notebook_id) {
        (map[n.notebook_id] ||= []).push(n);
      }
    });
    return map;
  }, [notes]);

  const visibleNotes = useMemo(() => {
    if (activeView === "all") return notes;
    if (activeView === "pinned") return pinnedNotes;
    return notesByNotebook[activeView] || [];
  }, [activeView, notes, pinnedNotes, notesByNotebook]);

  const mergeNoteLocally = useCallback((id: string, updates: Partial<Note>) => {
    setNotes((prev) =>
      prev.map((note) => (note.id === id ? { ...note, ...updates } : note))
    );
  }, []);

  const saveNote = useCallback(async (id: string, updates: Partial<Note>) => {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    const { data } = await supabase
      .from("notes")
      .update(payload as any)
      .eq("id", id)
      .select("id, title, content, folder, notebook_id, pinned, converted_doc_id, created_at, updated_at, is_public, share_token, shared_with")
      .single();

    if (data) {
      setNotes((prev) => prev.map((note) => (note.id === id ? (data as Note) : note)));
    }
  }, []);

  // Flush any pending debounced save immediately
  const flushPendingSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingSaveRef.current;
    if (pending) {
      pendingSaveRef.current = null;
      await saveNote(pending.id, pending.updates);
    }
  }, [saveNote]);

  const scheduleSave = useCallback((id: string, updates: Partial<Note>) => {
    // Merge into pending updates so title+content edits coalesce safely
    const prev = pendingSaveRef.current && pendingSaveRef.current.id === id
      ? pendingSaveRef.current.updates
      : {};
    pendingSaveRef.current = { id, updates: { ...prev, ...updates } };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const pending = pendingSaveRef.current;
      saveTimerRef.current = null;
      if (pending) {
        pendingSaveRef.current = null;
        saveNote(pending.id, pending.updates);
      }
    }, 500);
  }, [saveNote]);

  const selectNote = async (note: Note) => {
    await flushPendingSave();
    setSelectedId(note.id);
    setTitle(note.title);
    setContent(note.content);
  };

  const createNote = async () => {
    if (!user) return;
    await flushPendingSave();
    const notebookId = (activeView !== "all" && activeView !== "pinned") ? activeView : null;
    const { data, error } = await supabase
      .from("notes")
      .insert({ user_id: user.id, title: "Untitled Note", content: "", notebook_id: notebookId })
      .select()
      .single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    if (data) {
      // Auto-expand the notebook we created in
      if (notebookId) setExpandedNotebooks(prev => new Set(prev).add(notebookId));
      await fetchNotes();
      selectNote(data as any as Note);
    }
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (selectedId) {
      const nextUpdatedAt = new Date().toISOString();
      mergeNoteLocally(selectedId, { title: val, updated_at: nextUpdatedAt });
      scheduleSave(selectedId, { title: val, updated_at: nextUpdatedAt });
    }
  };

  const handleContentChange = (html: string) => {
    setContent(html);
    if (selectedId) {
      const nextUpdatedAt = new Date().toISOString();
      mergeNoteLocally(selectedId, { content: html, updated_at: nextUpdatedAt });
      scheduleSave(selectedId, { content: html, updated_at: nextUpdatedAt });
    }
  };

  // Flush on tab hide / before unload / unmount
  useEffect(() => {
    const flushSync = () => {
      const pending = pendingSaveRef.current;
      if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
      if (pending) {
        pendingSaveRef.current = null;
        // Fire and forget — keepalive not needed via supabase client; we just dispatch
        saveNote(pending.id, pending.updates);
      }
    };
    const onVis = () => { if (document.visibilityState === "hidden") flushSync(); };
    window.addEventListener("beforeunload", flushSync);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("beforeunload", flushSync);
      document.removeEventListener("visibilitychange", onVis);
      flushSync();
    };
  }, [saveNote]);


  const deleteNote = async (id: string) => {
    await supabase.from("notes").delete().eq("id", id);
    if (selectedId === id) { setSelectedId(null); setTitle(""); setContent(""); }
    fetchNotes();
    toast({ title: "Note deleted" });
  };

  const togglePin = async (note: Note) => {
    await supabase.from("notes").update({ pinned: !note.pinned } as any).eq("id", note.id);
    fetchNotes();
  };

  const moveToNotebook = async (noteId: string, notebookId: string | null) => {
    await supabase.from("notes").update({ notebook_id: notebookId } as any).eq("id", noteId);
    if (notebookId) setExpandedNotebooks(prev => new Set(prev).add(notebookId));
    fetchNotes();
  };

  const createNotebook = async () => {
    if (!newNotebookName.trim() || !user) return;
    const color = NOTEBOOK_COLORS[notebooks.length % NOTEBOOK_COLORS.length];
    const { data } = await supabase.from("note_folders").insert({ name: newNotebookName.trim(), user_id: user.id, color } as any).select().single();
    if (data) {
      setActiveView((data as any).id);
      setExpandedNotebooks(prev => new Set(prev).add((data as any).id));
    }
    setNewNotebookName("");
    setCreatingNotebook(false);
    fetchNotebooks();
  };

  const renameNotebook = async (id: string, newName: string) => {
    if (!newName.trim()) { setRenamingNotebook(null); return; }
    await supabase.from("note_folders").update({ name: newName.trim() } as any).eq("id", id);
    setRenamingNotebook(null);
    fetchNotebooks();
  };

  const setNotebookColor = async (id: string, color: string) => {
    await supabase.from("note_folders").update({ color } as any).eq("id", id);
    fetchNotebooks();
  };

  const deleteNotebook = async (id: string) => {
    // Notes auto-unlinked via FK ON DELETE SET NULL
    await supabase.from("note_folders").delete().eq("id", id);
    if (activeView === id) setActiveView("all");
    fetchNotebooks();
    fetchNotes();
    toast({ title: "Notebook removed", description: "Notes moved to All Notes" });
  };

  const toggleNotebook = (id: string) => {
    setActiveView(id);
    setExpandedNotebooks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openConvertDialog = () => { setConvertTitle(title || "Untitled"); setConvertOpen(true); };

  const convertToDoc = async () => {
    if (!selectedId || !user) return;
    const { data, error } = await supabase.from("documents").insert({
      title: convertTitle.trim() || title, content,
      author_id: user.id, author_name: profile?.full_name || "Unknown",
      visibility: "workspace",
    }).select("id").single();
    if (error) { toast({ title: "Error converting note", description: error.message, variant: "destructive" }); return; }
    if (data) {
      await supabase.from("notes").update({ converted_doc_id: data.id }).eq("id", selectedId);
      toast({ title: "Converted to document", description: `"${convertTitle}" is now in Docs.` });
      setConvertOpen(false);
      fetchNotes();
    }
  };

  const selectedNote = notes.find((n) => n.id === selectedId);
  const selectedNotebook = selectedNote?.notebook_id ? notebooks.find(nb => nb.id === selectedNote.notebook_id) : null;

  // Drag handlers
  const handleDropOnNotebook = async (notebookId: string | null) => {
    if (draggingNoteId) {
      await moveToNotebook(draggingNoteId, notebookId);
      toast({ title: notebookId ? "Moved to notebook" : "Moved to Unfiled" });
    }
    setDraggingNoteId(null);
    setDropTarget(null);
  };

  // Render a single note row in the sidebar
  const renderNoteRow = (note: Note, indent = false) => (
    <div
      key={note.id}
      draggable
      onDragStart={(e) => {
        setDraggingNoteId(note.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => { setDraggingNoteId(null); setDropTarget(null); }}
      className={`group relative px-2.5 py-1.5 cursor-pointer transition-colors rounded-md mx-1 ${
        selectedId === note.id ? "bg-accent" : "hover:bg-accent/40"
      } ${indent ? "ml-5" : ""} ${draggingNoteId === note.id ? "opacity-40" : ""}`}
      onClick={() => selectNote(note)}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[13px] font-medium truncate flex-1 min-w-0">{note.title}</span>
        {note.pinned && <Pin className="h-2.5 w-2.5 text-muted-foreground/60 fill-current shrink-0" />}
        {note.converted_doc_id && <FileText className="h-3 w-3 text-muted-foreground shrink-0" />}
        <span className="text-[10px] text-muted-foreground/70 tabular-nums shrink-0">{fmtDate(note.updated_at)}</span>
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      {/* Sidebar */}
      <div className="w-64 border-r border-border/50 flex flex-col shrink-0 bg-primary/[0.04]">
        <div className="p-3 border-b border-border/50 flex items-center justify-between">
          <h2 className="font-semibold text-sm">My Notes</h2>
          <Button size="icon" className="h-7 w-7" onClick={createNote}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-auto py-2 space-y-0.5">
          {/* Pinned section */}
          {pinnedNotes.length > 0 && (
            <div className="mb-2">
              <button
                onClick={() => setActiveView("pinned")}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                  activeView === "pinned" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Pin className="h-3 w-3 fill-current" />
                <span className="flex-1 text-left">Pinned</span>
                <span className="text-[10px] font-normal opacity-60">{pinnedNotes.length}</span>
              </button>
              <div className="mt-0.5">
                {pinnedNotes.map(n => renderNoteRow(n))}
              </div>
            </div>
          )}

          {/* Notebooks */}
          <div className="mt-1">
            {notebooks.map(nb => {
              const isActive = activeView === nb.id;
              const isExpanded = expandedNotebooks.has(nb.id);
              const nbNotes = notesByNotebook[nb.id] || [];
              return (
                <div key={nb.id}>
                  {renamingNotebook === nb.id ? (
                    <div className="px-2 py-1">
                      <Input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onBlur={() => renameNotebook(nb.id, renameValue)}
                        onKeyDown={e => { if (e.key === "Enter") renameNotebook(nb.id, renameValue); if (e.key === "Escape") setRenamingNotebook(null); }}
                        className="h-7 text-xs"
                      />
                    </div>
                  ) : (
                    <div
                      className={`group relative flex items-center mx-1 rounded-md transition-colors ${
                        isActive ? "bg-accent/60" : "hover:bg-accent/30"
                      } ${dropTarget === nb.id ? "ring-2 ring-primary/60" : ""}`}
                      style={
                        dropTarget === nb.id
                          ? { background: `hsl(${nb.color} / 0.18)` }
                          : isActive
                          ? { background: `hsl(${nb.color} / 0.1)` }
                          : undefined
                      }
                      onDragOver={(e) => {
                        if (draggingNoteId) {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dropTarget !== nb.id) setDropTarget(nb.id);
                        }
                      }}
                      onDragLeave={() => { if (dropTarget === nb.id) setDropTarget(null); }}
                      onDrop={(e) => { e.preventDefault(); handleDropOnNotebook(nb.id); }}
                    >
                      {/* Color accent bar when active */}
                      {isActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full" style={{ background: `hsl(${nb.color})` }} />
                      )}
                      <button
                        onClick={() => toggleNotebook(nb.id)}
                        className="flex-1 flex items-center gap-2 pl-3 pr-2 py-1.5 min-w-0"
                      >
                        <BookOpen className="h-3.5 w-3.5 shrink-0" style={{ color: `hsl(${nb.color})` }} />
                        <span className="text-[13px] font-medium truncate flex-1 text-left">{nb.name}</span>
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!user) return;
                          const { data } = await supabase
                            .from("notes")
                            .insert({ user_id: user.id, title: "Untitled Note", content: "", notebook_id: nb.id })
                            .select()
                            .single();
                          if (data) {
                            setExpandedNotebooks(prev => new Set(prev).add(nb.id));
                            setActiveView(nb.id);
                            await fetchNotes();
                            selectNote(data as any as Note);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-accent transition-opacity"
                        title="New note in notebook"
                      >
                        <Plus className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="opacity-0 group-hover:opacity-100 p-1 mr-1 rounded hover:bg-accent transition-opacity">
                            <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-44 p-1.5" align="end">
                          <div className="px-2 py-1.5">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                              <Palette className="h-3 w-3" /> Color
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {NOTEBOOK_COLORS.map(c => (
                                <button
                                  key={c}
                                  onClick={() => setNotebookColor(nb.id, c)}
                                  className={`h-4 w-4 rounded-full border-2 transition ${nb.color === c ? "border-foreground" : "border-transparent"}`}
                                  style={{ background: `hsl(${c})` }}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="h-px bg-border my-1" />
                          <button
                            onClick={() => { setRenamingNotebook(nb.id); setRenameValue(nb.name); }}
                            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-accent"
                          >
                            <Pencil className="h-3 w-3" /> Rename
                          </button>
                          <button
                            onClick={() => deleteNotebook(nb.id)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-destructive/10 text-destructive"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                  {isExpanded && nbNotes.length > 0 && (
                    <div className="mt-0.5 mb-1 relative">
                      <span className="absolute left-[18px] top-0 bottom-0 w-px bg-border/60" />
                      {nbNotes.map(n => renderNoteRow(n, true))}
                    </div>
                  )}
                </div>
              );
            })}

            {creatingNotebook ? (
              <div className="flex items-center gap-1 px-2 mt-1">
                <Input
                  autoFocus
                  value={newNotebookName}
                  onChange={e => setNewNotebookName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") createNotebook(); if (e.key === "Escape") setCreatingNotebook(false); }}
                  placeholder="Notebook name"
                  className="h-7 text-xs flex-1"
                />
                <button onClick={() => setCreatingNotebook(false)} className="p-1 text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreatingNotebook(true)}
                className="w-full flex items-center gap-2 px-3 py-1.5 mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="h-3 w-3" /> New Notebook
              </button>
            )}
          </div>

          {/* Unfiled notes (always shown) */}
          {(unfiledNotes.length > 0 || draggingNoteId) && (
            <div
              className={`mt-3 pt-2 border-t border-border/40 rounded-md transition-colors ${
                dropTarget === "unfiled" ? "bg-accent/40 ring-2 ring-primary/40" : ""
              }`}
              onDragOver={(e) => {
                if (draggingNoteId) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dropTarget !== "unfiled") setDropTarget("unfiled");
                }
              }}
              onDragLeave={() => { if (dropTarget === "unfiled") setDropTarget(null); }}
              onDrop={(e) => { e.preventDefault(); handleDropOnNotebook(null); }}
            >
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</div>
              {unfiledNotes.map(n => renderNoteRow(n))}
              {unfiledNotes.length === 0 && draggingNoteId && (
                <div className="px-3 py-3 text-xs text-muted-foreground/70 italic">Drop here to unfile</div>
              )}
            </div>
          )}

          {notes.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No notes yet. Create one to get started.
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-card">
        {selectedId ? (
          <>
            <div className="p-3 border-b border-border/50 flex items-center gap-2 bg-white dark:bg-card">
              <Input
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="border-0 text-lg font-semibold p-0 h-auto focus-visible:ring-0 focus-visible:border-0 shadow-none bg-white dark:bg-card"
                placeholder="Note title..."
              />
              <div className="flex gap-1 shrink-0 items-center">
                {/* Notebook picker */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground gap-1.5">
                      <BookOpen className="h-3 w-3" style={selectedNotebook ? { color: `hsl(${selectedNotebook.color})` } : undefined} />
                      {selectedNotebook?.name || "Unfiled"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1" align="end">
                    <button
                      onClick={() => moveToNotebook(selectedId, null)}
                      className={`w-full text-left px-2 py-1.5 text-xs rounded-md hover:bg-accent flex items-center gap-2 ${!selectedNote?.notebook_id ? "font-medium" : ""}`}
                    >
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                      Unfiled
                    </button>
                    {notebooks.map(nb => (
                      <button
                        key={nb.id}
                        onClick={() => moveToNotebook(selectedId, nb.id)}
                        className={`w-full text-left px-2 py-1.5 text-xs rounded-md hover:bg-accent flex items-center gap-2 ${selectedNote?.notebook_id === nb.id ? "font-medium" : ""}`}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${nb.color})` }} />
                        {nb.name}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>

                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-7 w-7 ${selectedNote?.pinned ? "text-primary" : "text-muted-foreground"}`}
                  onClick={() => selectedNote && togglePin(selectedNote)}
                  title={selectedNote?.pinned ? "Unpin" : "Pin"}
                >
                  {selectedNote?.pinned ? <Pin className="h-3.5 w-3.5 fill-current" /> : <PinOff className="h-3.5 w-3.5" />}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className={`h-7 text-xs gap-1 ${selectedNote?.is_public ? "border-primary/50 text-primary" : ""}`}
                  onClick={() => setShareOpen(true)}
                >
                  {selectedNote?.is_public ? <Globe className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
                  Share
                </Button>
                {!selectedNote?.converted_doc_id && (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={openConvertDialog}>
                    <ArrowRight className="h-3 w-3 mr-1" /> Doc
                  </Button>
                )}
                {selectedNote?.converted_doc_id && (
                  <span className="text-[10px] text-muted-foreground px-2 py-1 bg-muted rounded-full">Converted</span>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => deleteNote(selectedId)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-white dark:bg-card">
              <div className="px-6 lg:px-16 py-6">
                <RichTextEditor key={selectedId} content={content} onChange={handleContentChange} borderless placeholder="Start writing..." />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <FileText className="h-10 w-10 mx-auto opacity-20" />
              <p className="text-sm">Select a note or create a new one</p>
            </div>
          </div>
        )}
      </div>

      {/* Convert confirmation dialog */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Convert to Document</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will create a new document in Docs with the note's content.</p>
          <Input value={convertTitle} onChange={e => setConvertTitle(e.target.value)} placeholder="Document title" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertOpen(false)}>Cancel</Button>
            <Button onClick={convertToDoc}>Convert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share dialog */}
      {selectedNote && (
        <NoteShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          noteId={selectedNote.id}
          initialIsPublic={!!selectedNote.is_public}
          initialShareToken={selectedNote.share_token || null}
          initialSharedMemberIds={selectedNote.shared_with?.memberIds || []}
          onUpdated={(next) => {
            setNotes(prev => prev.map(n => n.id === selectedNote.id ? { ...n, ...next } : n));
          }}
        />
      )}
    </div>
  );
}
