import { useState } from "react";
import { docPages as initialDocs } from "@/lib/mock-data";
import type { DocPage } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileText, Search, ChevronRight, Plus, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import DocEditor from "@/components/DocEditor";

export default function DocsPage() {
  const { isAdmin, currentUser } = useAuth();
  const [docs, setDocs] = useState<DocPage[]>(initialDocs);
  const [search, setSearch] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocPage | null>(null);

  const filtered = docs.filter(
    (d) =>
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const rootDocs = filtered.filter((d) => !d.parentId);
  const selected = docs.find((d) => d.id === selectedDoc);
  const childDocs = selectedDoc ? docs.filter((d) => d.parentId === selectedDoc) : [];

  const handleNewDoc = () => {
    setEditingDoc(null);
    setEditorOpen(true);
  };

  const handleEditDoc = () => {
    if (selected) {
      setEditingDoc(selected);
      setEditorOpen(true);
    }
  };

  const handleSaveDoc = (data: { title: string; content: string; tags: string[]; parentId: string | null }) => {
    const now = new Date().toISOString().split("T")[0];
    if (editingDoc) {
      setDocs((prev) =>
        prev.map((d) =>
          d.id === editingDoc.id ? { ...d, ...data, updatedAt: now } : d
        )
      );
    } else {
      const newDoc: DocPage = {
        id: `d_${Date.now()}`,
        ...data,
        departmentId: null,
        author: currentUser.name,
        createdAt: now,
        updatedAt: now,
      };
      setDocs((prev) => [...prev, newDoc]);
      setSelectedDoc(newDoc.id);
    }
    setEditorOpen(false);
  };

  const handleDeleteDoc = () => {
    if (editingDoc) {
      setDocs((prev) => prev.filter((d) => d.id !== editingDoc.id && d.parentId !== editingDoc.id));
      setSelectedDoc(null);
      setEditorOpen(false);
    }
  };

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

      {/* Doc Content */}
      <div className="flex-1 p-6 overflow-auto">
        {selected ? (
          <div className="max-w-3xl mx-auto">
            <div className="mb-6">
              <div className="flex items-start justify-between">
                <h1 className="text-2xl font-bold tracking-tight">{selected.title}</h1>
                {isAdmin && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleEditDoc} title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                      setDocs((prev) => prev.filter((d) => d.id !== selected.id && d.parentId !== selected.id));
                      setSelectedDoc(null);
                    }} title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                <span>{selected.author}</span>
                <span>·</span>
                <span>Updated {selected.updatedAt}</span>
              </div>
              <div className="flex gap-1.5 mt-3">
                {selected.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
            </div>
            <div className="prose prose-sm max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: selected.content }} />
            {childDocs.length > 0 && (
              <div className="mt-8 border-t pt-6">
                <h3 className="text-sm font-semibold mb-3">Sub-pages</h3>
                <div className="space-y-2">
                  {childDocs.map((child) => (
                    <button key={child.id} onClick={() => setSelectedDoc(child.id)} className="w-full text-left">
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

      <DocEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSaveDoc}
        onDelete={editingDoc ? handleDeleteDoc : undefined}
        doc={editingDoc}
        allDocs={docs}
      />
    </div>
  );
}
