import { useState, useEffect, useRef, useCallback } from "react";
import { docPages as initialDocs } from "@/lib/mock-data";
import type { DocPage, Visibility, SharedWith } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileText, Search, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import DocEditor from "@/components/DocEditor";
import RichTextEditor from "@/components/RichTextEditor";

export default function DocsPage() {
  const { isAdmin, profile } = useAuth();
  const [docs, setDocs] = useState<DocPage[]>(initialDocs);
  const [search, setSearch] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [newDocOpen, setNewDocOpen] = useState(false);

  const filtered = docs.filter(
    (d) =>
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const rootDocs = filtered.filter((d) => !d.parentId);
  const selected = docs.find((d) => d.id === selectedDoc);
  const childDocs = selectedDoc ? docs.filter((d) => d.parentId === selectedDoc) : [];

  const handleNewDoc = () => {
    setNewDocOpen(true);
  };

  const handleCreateDoc = (data: { title: string; content: string; tags: string[]; parentId: string | null; visibility: Visibility; sharedWith: SharedWith }) => {
    const now = new Date().toISOString().split("T")[0];
    const newDoc: DocPage = {
      id: `d_${Date.now()}`,
      ...data,
      author: currentUser.name,
      createdAt: now,
      updatedAt: now,
    };
    setDocs((prev) => [...prev, newDoc]);
    setSelectedDoc(newDoc.id);
    setNewDocOpen(false);
  };

  const handleDeleteDoc = (docId: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== docId && d.parentId !== docId));
    if (selectedDoc === docId) setSelectedDoc(null);
  };

  // Inline update handler (debounced from InlineEditor)
  const handleInlineUpdate = useCallback((docId: string, updates: Partial<DocPage>) => {
    const now = new Date().toISOString().split("T")[0];
    setDocs((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, ...updates, updatedAt: now } : d))
    );
  }, []);

  return (
    <div className="flex h-full">
      {/* Doc Sidebar */}
      <div className="w-72 border-r bg-muted/30 p-4 space-y-3 shrink-0 overflow-auto">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search docs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
          </div>
          {isAdmin && (
            <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={handleNewDoc} title="New Page">
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="space-y-0.5">
          {rootDocs.map((doc) => {
            const children = docs.filter((d) => d.parentId === doc.id);
            const isSelected = selectedDoc === doc.id;
            return (
              <div key={doc.id}>
                <button
                  onClick={() => setSelectedDoc(doc.id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm flex items-center gap-2 hover:bg-muted transition-colors ${isSelected ? "bg-muted font-medium" : ""}`}
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{doc.title}</span>
                </button>
                {children.length > 0 && isSelected && (
                  <div className="ml-5 mt-0.5 space-y-0.5">
                    {children.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => setSelectedDoc(child.id)}
                        className={`w-full text-left px-2.5 py-1 rounded-md text-xs flex items-center gap-1.5 hover:bg-muted transition-colors ${selectedDoc === child.id ? "bg-muted font-medium" : "text-muted-foreground"}`}
                      >
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

      {/* Doc Content — inline editing */}
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
                <Button variant="outline" size="sm" className="mt-3" onClick={handleNewDoc}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Create New Page
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New Doc Dialog — only for creation */}
      <DocEditor
        open={newDocOpen}
        onClose={() => setNewDocOpen(false)}
        onSave={handleCreateDoc}
        doc={null}
        allDocs={docs}
      />
    </div>
  );
}

/** Notion-style inline doc editor with auto-save */
function InlineDocEditor({
  doc,
  isAdmin,
  onUpdate,
  onDelete,
  childDocs,
  onSelectChild,
}: {
  doc: DocPage;
  isAdmin: boolean;
  onUpdate: (updates: Partial<DocPage>) => void;
  onDelete: () => void;
  childDocs: DocPage[];
  onSelectChild: (id: string) => void;
}) {
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState(doc.content);
  const [tagsStr, setTagsStr] = useState(doc.tags.join(", "));
  const [editingTags, setEditingTags] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset when doc changes
  useEffect(() => {
    setTitle(doc.title);
    setContent(doc.content);
    setTagsStr(doc.tags.join(", "));
  }, [doc.id]);

  const scheduleAutoSave = useCallback(
    (updates: Partial<DocPage>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        onUpdate(updates);
      }, 1000);
    },
    [onUpdate]
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    scheduleAutoSave({ title: newTitle });
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    scheduleAutoSave({ content: newContent });
  };

  const handleTagsSave = () => {
    const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
    onUpdate({ tags });
    setEditingTags(false);
  };

  return (
    <div className="max-w-none">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          {isAdmin ? (
            <input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="text-2xl font-bold tracking-tight bg-transparent border-none outline-none w-full placeholder:text-muted-foreground/50 focus:ring-0"
              placeholder="Untitled"
            />
          ) : (
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          )}
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive shrink-0"
              onClick={onDelete}
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
          <span>{doc.author}</span>
          <span>·</span>
          <span>Updated {doc.updatedAt}</span>
          <span>·</span>
          <span className="capitalize">{doc.visibility}</span>
        </div>

        {/* Tags — inline editable */}
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          {editingTags && isAdmin ? (
            <div className="flex items-center gap-2 w-full">
              <Input
                value={tagsStr}
                onChange={(e) => setTagsStr(e.target.value)}
                onBlur={handleTagsSave}
                onKeyDown={(e) => e.key === "Enter" && handleTagsSave()}
                className="h-7 text-xs flex-1"
                placeholder="tag1, tag2, tag3"
                autoFocus
              />
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleTagsSave}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <>
              {doc.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs cursor-default">
                  {tag}
                </Badge>
              ))}
              {isAdmin && (
                <button
                  onClick={() => setEditingTags(true)}
                  className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors"
                >
                  + tag
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Content — inline RichTextEditor for admins, rendered HTML for viewers */}
      {isAdmin ? (
        <RichTextEditor
          content={content}
          onChange={handleContentChange}
          placeholder="Start writing..."
        />
      ) : (
        <div
          className="prose prose-sm max-w-none text-foreground"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      )}

      {/* Sub-pages */}
      {childDocs.length > 0 && (
        <div className="mt-8 border-t pt-6">
          <h3 className="text-sm font-semibold mb-3">Sub-pages</h3>
          <div className="space-y-2">
            {childDocs.map((child) => (
              <button key={child.id} onClick={() => onSelectChild(child.id)} className="w-full text-left">
                <Card className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{child.title}</span>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}