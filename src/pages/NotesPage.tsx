import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, FileText, ArrowRight, Trash2, FolderOpen, Folder, MoreHorizontal, Pencil, X, Share2, Globe } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import RichTextEditor from "@/components/RichTextEditor";
import { NoteShareDialog } from "@/components/notes/NoteShareDialog";

interface Note {
  id: string;
  title: string;
  content: string;
  folder: string | null;
  converted_doc_id: string | null;
  created_at: string;
  updated_at: string;
  is_public?: boolean;
  share_token?: string | null;
  shared_with?: any;
}

export default function NotesPage() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertTitle, setConvertTitle] = useState("");
  const [shareOpen, setShareOpen] = useState(false);

  // Folder state
  const [activeFolder, setActiveFolder] = useState<string | null>(null); // null = All Notes
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const fetchNotes = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notes")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (data) setNotes(data as Note[]);
  }, [user]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  // Handle instant-create from GlobalCreateMenu
  useEffect(() => {
    const state = location.state as { selectNoteId?: string } | null;
    if (state?.selectNoteId && notes.length > 0) {
      const note = notes.find(n => n.id === state.selectNoteId);
      if (note) selectNote(note);
      window.history.replaceState({}, document.title);
    }
  }, [location.state, notes]);

  // Fetch folders from DB
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const fetchFolders = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("note_folders").select("id, name").eq("user_id", user.id).order("sort_order");
    if (data) setFolders(data as any[]);
  }, [user]);
  useEffect(() => { fetchFolders(); }, [fetchFolders]);
  const folderNames = folders.map(f => f.name);

  const filteredNotes = useMemo(() => {
    if (activeFolder === null) return notes;
    return notes.filter(n => n.folder === activeFolder);
  }, [notes, activeFolder]);

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    notes.forEach(n => {
      const f = n.folder || "__unfiled";
      counts[f] = (counts[f] || 0) + 1;
    });
    return counts;
  }, [notes]);

  const selectNote = (note: Note) => {
    setSelectedId(note.id);
    setTitle(note.title);
    setContent(note.content);
  };

  const createNote = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("notes")
      .insert({ user_id: user.id, title: "Untitled Note", content: "", folder: activeFolder })
      .select()
      .single();
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    if (data) {
      await fetchNotes();
      selectNote(data as Note);
    }
  };

  const saveNote = useCallback(async (id: string, updates: Partial<Note>) => {
    await supabase.from("notes").update(updates).eq("id", id);
  }, []);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (selectedId) {
      if (saveTimer) clearTimeout(saveTimer);
      setSaveTimer(setTimeout(() => saveNote(selectedId, { title: val }), 500));
    }
  };

  const handleContentChange = (html: string) => {
    setContent(html);
    if (selectedId) {
      if (saveTimer) clearTimeout(saveTimer);
      setSaveTimer(setTimeout(() => saveNote(selectedId, { content: html }), 500));
    }
  };

  const deleteNote = async (id: string) => {
    await supabase.from("notes").delete().eq("id", id);
    if (selectedId === id) {
      setSelectedId(null);
      setTitle("");
      setContent("");
    }
    fetchNotes();
    toast({ title: "Note deleted" });
  };

  const moveToFolder = async (noteId: string, folder: string | null) => {
    await supabase.from("notes").update({ folder }).eq("id", noteId);
    fetchNotes();
  };

  const createFolder = async () => {
    if (!newFolderName.trim() || !user) return;
    await supabase.from("note_folders").insert({ name: newFolderName.trim(), user_id: user.id });
    setActiveFolder(newFolderName.trim());
    setNewFolderName("");
    setCreatingFolder(false);
    fetchFolders();
  };

  const renameFolder = async (oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) { setRenamingFolder(null); return; }
    // Update all notes in this folder
    const notesInFolder = notes.filter(n => n.folder === oldName);
    for (const n of notesInFolder) {
      await supabase.from("notes").update({ folder: newName.trim() }).eq("id", n.id);
    }
    if (activeFolder === oldName) setActiveFolder(newName.trim());
    setRenamingFolder(null);
    fetchNotes();
  };

  const deleteFolder = async (folderName: string) => {
    // Move all notes in this folder to unfiled
    const notesInFolder = notes.filter(n => n.folder === folderName);
    for (const n of notesInFolder) {
      await supabase.from("notes").update({ folder: null }).eq("id", n.id);
    }
    if (activeFolder === folderName) setActiveFolder(null);
    fetchNotes();
    toast({ title: "Folder removed", description: "Notes moved to All Notes" });
  };

  const openConvertDialog = () => {
    setConvertTitle(title || "Untitled");
    setConvertOpen(true);
  };

  const convertToDoc = async () => {
    if (!selectedId || !user) return;
    const { data, error } = await supabase
      .from("documents")
      .insert({
        title: convertTitle.trim() || title,
        content,
        author_id: user.id,
        author_name: profile?.full_name || "Unknown",
        visibility: "workspace",
      })
      .select("id")
      .single();
    if (error) {
      toast({ title: "Error converting note", description: error.message, variant: "destructive" });
      return;
    }
    if (data) {
      await supabase.from("notes").update({ converted_doc_id: data.id }).eq("id", selectedId);
      toast({ title: "Converted to document", description: `"${convertTitle}" is now in Docs.` });
      setConvertOpen(false);
      fetchNotes();
    }
  };

  const selectedNote = notes.find((n) => n.id === selectedId);

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      {/* Sidebar */}
      <div className="w-60 border-r border-border/50 flex flex-col shrink-0 bg-primary/[0.04]">
        <div className="p-3 border-b border-border/50 flex items-center justify-between">
          <h2 className="font-semibold text-sm">My Notes</h2>
          <Button size="icon" className="h-7 w-7" onClick={createNote}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Folder navigation */}
        <div className="px-2 pt-2 pb-1 space-y-0.5">
          <button
            onClick={() => setActiveFolder(null)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeFolder === null ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50"
            }`}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span className="flex-1 text-left">All Notes</span>
            <span className="text-[10px] text-muted-foreground">{notes.length}</span>
          </button>

          {folderNames.map(f => (
            <div key={f} className="group flex items-center">
              {renamingFolder === f ? (
                <Input
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={() => renameFolder(f, renameValue)}
                  onKeyDown={e => { if (e.key === "Enter") renameFolder(f, renameValue); if (e.key === "Escape") setRenamingFolder(null); }}
                  className="h-7 text-xs px-2 mx-1"
                />
              ) : (
                <button
                  onClick={() => setActiveFolder(f)}
                  className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeFolder === f ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50"
                  }`}
                >
                  <Folder className="h-3.5 w-3.5" />
                  <span className="flex-1 text-left truncate">{f}</span>
                  <span className="text-[10px] text-muted-foreground">{folderCounts[f] || 0}</span>
                </button>
              )}
              {renamingFolder !== f && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-accent transition-opacity">
                      <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-32 p-1" align="end">
                    <button
                      onClick={() => { setRenamingFolder(f); setRenameValue(f); }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg hover:bg-accent"
                    >
                      <Pencil className="h-3 w-3" /> Rename
                    </button>
                    <button
                      onClick={() => deleteFolder(f)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg hover:bg-destructive/10 text-destructive"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          ))}

          {creatingFolder ? (
            <div className="flex items-center gap-1 px-1">
              <Input
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") createFolder(); if (e.key === "Escape") setCreatingFolder(false); }}
                placeholder="Folder name"
                className="h-7 text-xs flex-1"
              />
              <button onClick={() => setCreatingFolder(false)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreatingFolder(true)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="h-3 w-3" /> New Folder
            </button>
          )}
        </div>

        {/* Notes list — clean: title + date only */}
        <div className="flex-1 overflow-auto border-t border-border/50 mt-1">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className={`px-3 py-2 cursor-pointer transition-colors border-b border-border/30 ${
                selectedId === note.id ? "bg-accent" : "hover:bg-accent/30"
              }`}
              onClick={() => selectNote(note)}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate flex-1">{note.title}</span>
                {note.converted_doc_id && (
                  <FileText className="h-3 w-3 text-muted-foreground shrink-0 ml-1" />
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {new Date(note.updated_at).toLocaleDateString()}
              </span>
            </div>
          ))}
          {filteredNotes.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {activeFolder ? "No notes in this folder." : "No notes yet. Create one to get started."}
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
                {/* Folder picker */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground gap-1">
                      <Folder className="h-3 w-3" />
                      {selectedNote?.folder || "Unfiled"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-40 p-1" align="end">
                    <button
                      onClick={() => moveToFolder(selectedId, null)}
                      className={`w-full text-left px-2 py-1.5 text-xs rounded-lg hover:bg-accent ${!selectedNote?.folder ? "font-medium" : ""}`}
                    >
                      Unfiled
                    </button>
                    {folderNames.map(f => (
                      <button
                        key={f}
                        onClick={() => moveToFolder(selectedId, f)}
                        className={`w-full text-left px-2 py-1.5 text-xs rounded-lg hover:bg-accent ${selectedNote?.folder === f ? "font-medium" : ""}`}
                      >
                        {f}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>

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
                  <span className="text-[10px] text-muted-foreground px-2 py-1 bg-muted rounded-full">
                    Converted
                  </span>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => deleteNote(selectedId)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <RichTextEditor key={selectedId} content={content} onChange={handleContentChange} borderless placeholder="Start writing..." />
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
