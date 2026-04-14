import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, FileText, ArrowRight, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import RichTextEditor from "@/components/RichTextEditor";

interface Note {
  id: string;
  title: string;
  content: string;
  converted_doc_id: string | null;
  created_at: string;
  updated_at: string;
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
      // Clear state
      window.history.replaceState({}, document.title);
    }
  }, [location.state, notes]);

  const selectNote = (note: Note) => {
    setSelectedId(note.id);
    setTitle(note.title);
    setContent(note.content);
  };

  const createNote = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("notes")
      .insert({ user_id: user.id, title: "Untitled Note", content: "" })
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

  const getPreview = (html: string) => {
    if (!html) return "Empty note";
    const text = html.replace(/<[^>]+>/g, "").trim();
    return text.slice(0, 80) || "Empty note";
  };

  const selectedNote = notes.find((n) => n.id === selectedId);

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      {/* Sidebar */}
      <div className="w-64 border-r flex flex-col shrink-0">
        <div className="p-3 border-b flex items-center justify-between">
          <h2 className="font-semibold text-sm">Notes</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={createNote}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto">
          {notes.map((note) => (
            <div
              key={note.id}
              className={`p-3 border-b cursor-pointer hover:bg-accent/50 transition-colors ${
                selectedId === note.id ? "bg-accent" : ""
              }`}
              onClick={() => selectNote(note)}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate flex-1">{note.title}</span>
                {note.converted_doc_id && (
                  <FileText className="h-3 w-3 text-muted-foreground shrink-0 ml-1" />
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{getPreview(note.content)}</p>
              <span className="text-[10px] text-muted-foreground">
                {new Date(note.updated_at).toLocaleDateString()} · {new Date(note.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
          {notes.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No notes yet. Create one to get started.
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedId ? (
          <>
            <div className="p-3 border-b flex items-center gap-2">
              <Input
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="border-0 text-lg font-semibold p-0 h-auto focus-visible:ring-0 shadow-none"
                placeholder="Note title..."
              />
              <div className="flex gap-1 shrink-0">
                {!selectedNote?.converted_doc_id && (
                  <Button variant="outline" size="sm" onClick={openConvertDialog}>
                    <ArrowRight className="h-3 w-3 mr-1" /> Convert to Doc
                  </Button>
                )}
                {selectedNote?.converted_doc_id && (
                  <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
                    Converted
                  </span>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => deleteNote(selectedId)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <RichTextEditor content={content} onChange={handleContentChange} borderless placeholder="Start writing..." />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <FileText className="h-10 w-10 mx-auto opacity-30" />
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
          <div>
            <label className="text-sm font-medium">Document title</label>
            <Input value={convertTitle} onChange={e => setConvertTitle(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertOpen(false)}>Cancel</Button>
            <Button onClick={convertToDoc}>Convert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
