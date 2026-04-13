import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Visibility, SharedWith } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileText, Search, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import DocEditor from "@/components/DocEditor";
import RichTextEditor from "@/components/RichTextEditor";

interface Doc {
  id: string;
  title: string;
  content: string;
  parentId: string | null;
  visibility: Visibility;
  sharedWith: SharedWith;
  author: string;
  authorId: string | null;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

function mapRow(row: any): Doc {
  return {
    id: row.id,
    title: row.title,
    content: row.content || "",
    parentId: row.parent_id,
    visibility: row.visibility as Visibility,
    sharedWith: (row.shared_with as SharedWith) || { departmentIds: [], memberIds: [] },
    author: row.author_name || "Unknown",
    authorId: row.author_id,
    createdAt: row.created_at?.split("T")[0] || "",
    updatedAt: row.updated_at?.split("T")[0] || "",
    tags: row.tags || [],
  };
}

export default function DocsPage() {
  const { isAdmin, profile, user } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [search, setSearch] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [newDocOpen, setNewDocOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  useEffect(() => {
    const fetchDocs = async () => {
      const { data } = await supabase.from("documents").select("*").order("created_at");
      if (data) setDocs(data.map(mapRow));
      setLoading(false);
    };
    fetchDocs();
  }, []);

  // Collect all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    docs.forEach((d) => d.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [docs]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const filtered = docs.filter((d) => {
    const matchesSearch =
      !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchesTags =
      selectedTags.length === 0 ||
      selectedTags.every((st) => d.tags.includes(st));
    return matchesSearch && matchesTags;
  });

  const rootDocs = filtered.filter((d) => !d.parentId);
  const selected = docs.find((d) => d.id === selectedDoc);
  const childDocs = selectedDoc ? docs.filter((d) => d.parentId === selectedDoc) : [];

  const handleCreateDoc = async (data: { title: string; content: string; tags: string[]; parentId: string | null; visibility: Visibility; sharedWith: SharedWith }) => {
    const { data: newRow } = await supabase
      .from("documents")
      .insert({
        title: data.title,
        content: data.content,
        tags: data.tags,
        parent_id: data.parentId,
        visibility: data.visibility,
        shared_with: data.sharedWith as any,
        author_id: user?.id || null,
        author_name: profile?.full_name || "Unknown",
      })
      .select()
      .single();

    if (newRow) {
      setDocs((prev) => [...prev, mapRow(newRow)]);
      setSelectedDoc(newRow.id);
    }
    setNewDocOpen(false);
  };

  const handleDeleteDoc = async (docId: string) => {
    await supabase.from("documents").delete().eq("id", docId);
    setDocs((prev) => prev.filter((d) => d.id !== docId && d.parentId !== docId));
    if (selectedDoc === docId) setSelectedDoc(null);
  };

  const handleInlineUpdate = useCallback(async (docId: string, updates: Partial<Doc>) => {
    setDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, ...updates } : d)));
    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.content !== undefined) dbUpdates.content = updates.content;
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
    await supabase.from("documents").update(dbUpdates).eq("id", docId);
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading docs...</div>;

  const allDocsForEditor = docs.map((d) => ({
    id: d.id, title: d.title, content: d.content, parentId: d.parentId,
    visibility: d.visibility, sharedWith: d.sharedWith, author: d.author,
    createdAt: d.createdAt, updatedAt: d.updatedAt, tags: d.tags,
  }));

  return (
    <div className="flex h-full">
      <div className="w-72 border-r bg-muted/30 p-4 space-y-3 shrink-0 overflow-auto">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search docs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
          </div>
          {isAdmin && (
            <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => setNewDocOpen(true)} title="New Page">
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Tag filter bar */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors border ${
                  selectedTags.includes(tag)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                }`}
              >
                {tag}
              </button>
            ))}
            {selectedTags.length > 0 && (
              <button
                onClick={() => setSelectedTags([])}
                className="text-[11px] text-muted-foreground hover:text-foreground px-1"
              >
                Clear
              </button>
            )}
          </div>
        )}

        <div className="space-y-0.5">
          {rootDocs.map((doc) => {
            const children = docs.filter((d) => d.parentId === doc.id);
            const isSelected = selectedDoc === doc.id;
            return (
              <div key={doc.id}>
                <button onClick={() => setSelectedDoc(doc.id)} className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm flex items-center gap-2 hover:bg-muted transition-colors ${isSelected ? "bg-muted font-medium" : ""}`}>
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{doc.title}</span>
                </button>
                {children.length > 0 && isSelected && (
                  <div className="ml-5 mt-0.5 space-y-0.5">
                    {children.map((child) => (
                      <button key={child.id} onClick={() => setSelectedDoc(child.id)} className={`w-full text-left px-2.5 py-1 rounded-md text-xs flex items-center gap-1.5 hover:bg-muted transition-colors ${selectedDoc === child.id ? "bg-muted font-medium" : "text-muted-foreground"}`}>
                        <ChevronRight className="h-3 w-3 shrink-0" />
                        <span className="truncate">{child.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        {selected ? (
          <InlineDocEditor
            key={selected.id}
            doc={selected}
            isAdmin={isAdmin}
            onUpdate={(updates) => handleInlineUpdate(selected.id, updates)}
            onDelete={() => handleDeleteDoc(selected.id)}
            childDocs={childDocs}
            onSelectChild={(id) => setSelectedDoc(id)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Select a document to view</p>
              {isAdmin && (
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setNewDocOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Create New Page
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <DocEditor open={newDocOpen} onClose={() => setNewDocOpen(false)} onSave={handleCreateDoc} doc={null} allDocs={allDocsForEditor} />
    </div>
  );
}

function InlineDocEditor({ doc, isAdmin, onUpdate, onDelete, childDocs, onSelectChild }: {
  doc: Doc; isAdmin: boolean; onUpdate: (updates: Partial<Doc>) => void; onDelete: () => void; childDocs: Doc[]; onSelectChild: (id: string) => void;
}) {
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState(doc.content);
  const [tags, setTags] = useState<string[]>(doc.tags);
  const [tagInput, setTagInput] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setTitle(doc.title); setContent(doc.content); setTags(doc.tags); setTagInput(""); }, [doc.id]);

  const scheduleAutoSave = useCallback((updates: Partial<Doc>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onUpdate(updates), 1000);
  }, [onUpdate]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const addTag = (value: string) => {
    const tag = value.trim();
    if (tag && !tags.includes(tag)) {
      const newTags = [...tags, tag];
      setTags(newTags);
      onUpdate({ tags: newTags });
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    const newTags = tags.filter((t) => t !== tag);
    setTags(newTags);
    onUpdate({ tags: newTags });
  };

  return (
    <div className="max-w-none">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          {isAdmin ? (
            <input value={title} onChange={(e) => { setTitle(e.target.value); scheduleAutoSave({ title: e.target.value }); }} className="text-2xl font-bold tracking-tight bg-transparent border-none outline-none w-full placeholder:text-muted-foreground/50 focus:ring-0" placeholder="Untitled" />
          ) : (
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          )}
          {isAdmin && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={onDelete} title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
          <span>{doc.author}</span><span>·</span><span>Updated {doc.updatedAt}</span><span>·</span><span className="capitalize">{doc.visibility}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs gap-1 pr-1">
              {tag}
              {isAdmin && (
                <button onClick={() => removeTag(tag)} className="ml-0.5 hover:text-destructive transition-colors">
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
          {isAdmin && (
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && tagInput.trim()) {
                  e.preventDefault();
                  addTag(tagInput);
                } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
                  removeTag(tags[tags.length - 1]);
                }
              }}
              onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
              className="text-xs bg-transparent border-none outline-none placeholder:text-muted-foreground/50 w-20 py-0.5"
              placeholder="+ tag"
            />
          )}
        </div>
      </div>

      {isAdmin ? (
        <RichTextEditor content={content} onChange={(c) => { setContent(c); scheduleAutoSave({ content: c }); }} placeholder="Start writing..." />
      ) : (
        <div className="prose prose-sm max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: content }} />
      )}

      {childDocs.length > 0 && (
        <div className="mt-8 border-t pt-6">
          <h3 className="text-sm font-semibold mb-3">Sub-pages</h3>
          <div className="space-y-2">
            {childDocs.map((child) => (
              <button key={child.id} onClick={() => onSelectChild(child.id)} className="w-full text-left">
                <Card className="hover:shadow-sm transition-shadow"><CardContent className="p-3 flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">{child.title}</span></CardContent></Card>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
