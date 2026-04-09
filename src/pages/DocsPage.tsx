import { useState } from "react";
import { docPages } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FileText, Search, ChevronRight } from "lucide-react";

export default function DocsPage() {
  const [search, setSearch] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);

  const filtered = docPages.filter(
    (d) =>
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const rootDocs = filtered.filter((d) => !d.parentId);
  const selected = docPages.find((d) => d.id === selectedDoc);
  const childDocs = selectedDoc ? docPages.filter((d) => d.parentId === selectedDoc) : [];

  return (
    <div className="flex h-full">
      {/* Doc Sidebar */}
      <div className="w-72 border-r bg-muted/30 p-4 space-y-3 shrink-0 overflow-auto">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search docs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <div className="space-y-0.5">
          {rootDocs.map((doc) => {
            const children = docPages.filter((d) => d.parentId === doc.id);
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
              <h1 className="text-2xl font-bold tracking-tight">{selected.title}</h1>
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
            <div className="prose prose-sm max-w-none">
              <p className="text-muted-foreground leading-relaxed">{selected.content}</p>
            </div>
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
