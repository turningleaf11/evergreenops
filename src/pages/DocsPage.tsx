import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import BacklinksPanel from "@/components/docs/BacklinksPanel";
import DocCover from "@/components/docs/DocCover";
import { supabase } from "@/integrations/supabase/client";
import type { Visibility, SharedWith } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Search, ChevronRight, Plus, Trash2, X, Filter, ChevronDown, Shield, Building2, Users, Globe } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import RichTextEditor from "@/components/RichTextEditor";
import AccessPicker from "@/components/AccessPicker";

interface Doc {
  id: string;
  title: string;
  content: string;
  parentId: string | null;
  projectId: string | null;
  visibility: Visibility;
  sharedWith: SharedWith;
  author: string;
  authorId: string | null;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  cover_url: string | null;
  icon: string | null;
}

function mapRow(row: any): Doc {
  return {
    id: row.id,
    title: row.title,
    content: row.content || "",
    parentId: row.parent_id,
    projectId: row.project_id || null,
    visibility: row.visibility as Visibility,
    sharedWith: (row.shared_with as SharedWith) || { departmentIds: [], memberIds: [] },
    author: row.author_name || "Unknown",
    authorId: row.author_id,
    createdAt: row.created_at?.split("T")[0] || "",
    updatedAt: row.updated_at?.split("T")[0] || "",
    tags: row.tags || [],
    cover_url: row.cover_url || null,
    icon: row.icon || null,
  };
}

export default function DocsPage() {
  const { isAdmin, profile, user } = useAuth();
  const { departments } = useDepartments();
  const [searchParams, setSearchParams] = useSearchParams();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [search, setSearch] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<string | null>(searchParams.get("id"));
  const [loading, setLoading] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Sync selection -> URL
  useEffect(() => {
    const current = searchParams.get("id");
    if (selectedDoc && selectedDoc !== current) {
      setSearchParams({ id: selectedDoc }, { replace: true });
    } else if (!selectedDoc && current) {
      const params = new URLSearchParams(searchParams);
      params.delete("id");
      setSearchParams(params, { replace: true });
    }
  }, [selectedDoc]);

  // Sync URL -> selection (e.g. peek "Open full doc" button)
  useEffect(() => {
    const id = searchParams.get("id");
    if (id && id !== selectedDoc) setSelectedDoc(id);
  }, [searchParams]);

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
    // Visibility filter for non-admins
    const matchesVisibility = isAdmin || (() => {
      if (d.visibility === "workspace") return true;
      if (d.visibility === "private") return d.authorId === user?.id;
      // department or departments scope
      const sw = d.sharedWith || { departmentIds: [], memberIds: [] };
      return (sw.departmentIds || []).includes(profile?.department_id || "") ||
             (sw.memberIds || []).includes(user?.id || "");
    })();
    return matchesSearch && matchesTags && matchesVisibility;
  });

  const rootDocs = filtered.filter((d) => !d.parentId);
  const selected = docs.find((d) => d.id === selectedDoc);
  const childDocs = selectedDoc ? docs.filter((d) => d.parentId === selectedDoc) : [];

  // Group root docs into Company / Departments / Shared with me
  const groupedDocs = useMemo(() => {
    const company: Doc[] = [];
    const byDept: Record<string, Doc[]> = {};
    const sharedWithMe: Doc[] = [];

    rootDocs.forEach((d) => {
      if (d.visibility === "workspace") {
        company.push(d);
      } else if (d.visibility === "departments") {
        const deptIds = d.sharedWith?.departmentIds || [];
        if (deptIds.length === 0) {
          sharedWithMe.push(d);
        } else {
          deptIds.forEach((did) => {
            if (!byDept[did]) byDept[did] = [];
            byDept[did].push(d);
          });
        }
      } else if (d.visibility === "private") {
        if (d.authorId === user?.id) sharedWithMe.push(d);
      } else {
        // member-shared
        const memberIds = d.sharedWith?.memberIds || [];
        if (memberIds.includes(user?.id || "")) sharedWithMe.push(d);
      }
    });

    return { company, byDept, sharedWithMe };
  }, [rootDocs, user?.id]);

  const toggleGroup = (key: string) => setCollapsedGroups((p) => ({ ...p, [key]: !p[key] }));

  const handleCreateDoc = async () => {
    const { data: newRow } = await supabase
      .from("documents")
      .insert({
        title: "Untitled",
        content: "",
        tags: [],
        parent_id: null,
        visibility: "workspace",
        shared_with: { departmentIds: [], memberIds: [] },
        author_id: user?.id || null,
        author_name: profile?.full_name || "Unknown",
      })
      .select()
      .single();

    if (newRow) {
      setDocs((prev) => [...prev, mapRow(newRow)]);
      setSelectedDoc(newRow.id);
    }
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
    if (updates.visibility !== undefined) dbUpdates.visibility = updates.visibility;
    if (updates.sharedWith !== undefined) dbUpdates.shared_with = updates.sharedWith;
    if (updates.parentId !== undefined) dbUpdates.parent_id = updates.parentId;
    if (updates.cover_url !== undefined) dbUpdates.cover_url = updates.cover_url;
    if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
    await supabase.from("documents").update(dbUpdates).eq("id", docId);
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading docs...</div>;

  // Build breadcrumb path
  const buildBreadcrumb = (docId: string): Doc[] => {
    const trail: Doc[] = [];
    let current = docs.find(d => d.id === docId);
    while (current) {
      trail.unshift(current);
      current = current.parentId ? docs.find(d => d.id === current!.parentId) : undefined;
    }
    return trail;
  };

  const breadcrumb = selectedDoc ? buildBreadcrumb(selectedDoc) : [];

  // Recursive tree component
  const DocTreeItem = ({ doc, depth = 0 }: { doc: Doc; depth?: number }) => {
    const children = docs.filter(d => d.parentId === doc.id);
    const isSelected = selectedDoc === doc.id;
    const [expanded, setExpanded] = useState(isSelected || children.some(c => c.id === selectedDoc));

    return (
      <div>
        <button
          onClick={() => setSelectedDoc(doc.id)}
          className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm flex items-center gap-1.5 hover:bg-primary/10 transition-colors ${isSelected ? "bg-primary/15 font-medium" : ""}`}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          {children.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="p-0.5 hover:bg-accent rounded"
            >
              <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
            </button>
          )}
          {children.length === 0 && <span className="w-4" />}
          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{doc.title}</span>
        </button>
        {expanded && children.length > 0 && (
          <div>
            {children.map(child => (
              <DocTreeItem key={child.id} doc={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full">
      <div className="w-72 border-r border-border/50 bg-primary/[0.04] p-4 space-y-3 shrink-0 overflow-auto">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search wiki..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
          </div>
          {isAdmin && (
            <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleCreateDoc} title="New Page">
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Tag filter dropdown */}
        {allTags.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between h-8 text-xs">
                <span className="flex items-center gap-1.5">
                  <Filter className="h-3 w-3" />
                  {selectedTags.length > 0 ? `${selectedTags.length} tag${selectedTags.length > 1 ? "s" : ""} selected` : "Filter by tag"}
                </span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {allTags.map((tag) => (
                  <label key={tag} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm">
                    <Checkbox
                      checked={selectedTags.includes(tag)}
                      onCheckedChange={() => toggleTag(tag)}
                    />
                    <span className="text-xs">{tag}</span>
                  </label>
                ))}
              </div>
              {selectedTags.length > 0 && (
                <Button variant="ghost" size="sm" className="w-full mt-2 h-7 text-xs text-muted-foreground" onClick={() => setSelectedTags([])}>
                  Clear all
                </Button>
              )}
            </PopoverContent>
          </Popover>
        )}

        <div className="space-y-3">
          {/* Company group */}
          {groupedDocs.company.length > 0 && (
            <div>
              <button
                onClick={() => toggleGroup("company")}
                className="flex items-center gap-1.5 w-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className={`h-3 w-3 transition-transform ${!collapsedGroups.company ? "rotate-90" : ""}`} />
                <Globe className="h-3 w-3" />
                <span>Company</span>
                <span className="ml-auto text-[10px] opacity-60">{groupedDocs.company.length}</span>
              </button>
              {!collapsedGroups.company && (
                <div className="space-y-0.5 mt-1">
                  {groupedDocs.company.map((doc) => <DocTreeItem key={doc.id} doc={doc} />)}
                </div>
              )}
            </div>
          )}

          {/* Departments group */}
          {Object.keys(groupedDocs.byDept).length > 0 && (
            <div>
              <button
                onClick={() => toggleGroup("departments")}
                className="flex items-center gap-1.5 w-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className={`h-3 w-3 transition-transform ${!collapsedGroups.departments ? "rotate-90" : ""}`} />
                <Building2 className="h-3 w-3" />
                <span>Departments</span>
              </button>
              {!collapsedGroups.departments && (
                <div className="space-y-1 mt-1">
                  {departments
                    .filter((d) => groupedDocs.byDept[d.id]?.length)
                    .map((dept) => {
                      const key = `dept-${dept.id}`;
                      return (
                        <div key={dept.id}>
                          <button
                            onClick={() => toggleGroup(key)}
                            className="flex items-center gap-1.5 w-full px-2 py-1 text-xs font-medium text-foreground/80 hover:text-foreground transition-colors"
                          >
                            <ChevronRight className={`h-3 w-3 transition-transform ${!collapsedGroups[key] ? "rotate-90" : ""}`} />
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: `hsl(${dept.color})` }} />
                            <span className="truncate">{dept.name}</span>
                            <span className="ml-auto text-[10px] opacity-60">{groupedDocs.byDept[dept.id].length}</span>
                          </button>
                          {!collapsedGroups[key] && (
                            <div className="space-y-0.5 mt-0.5 ml-2">
                              {groupedDocs.byDept[dept.id].map((doc) => <DocTreeItem key={doc.id} doc={doc} />)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* Shared with me */}
          {groupedDocs.sharedWithMe.length > 0 && (
            <div>
              <button
                onClick={() => toggleGroup("shared")}
                className="flex items-center gap-1.5 w-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className={`h-3 w-3 transition-transform ${!collapsedGroups.shared ? "rotate-90" : ""}`} />
                <Users className="h-3 w-3" />
                <span>Shared with me</span>
                <span className="ml-auto text-[10px] opacity-60">{groupedDocs.sharedWithMe.length}</span>
              </button>
              {!collapsedGroups.shared && (
                <div className="space-y-0.5 mt-1">
                  {groupedDocs.sharedWithMe.map((doc) => <DocTreeItem key={doc.id} doc={doc} />)}
                </div>
              )}
            </div>
          )}

          {rootDocs.length === 0 && (
            <div className="px-2 py-6 text-center text-xs text-muted-foreground">No pages yet</div>
          )}
        </div>
      </div>

      <div className="flex-1 px-6 lg:px-16 py-6 overflow-auto bg-white dark:bg-card">
        {/* Breadcrumb */}
        {breadcrumb.length > 0 && (
          <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
            <button onClick={() => setSelectedDoc(null)} className="hover:text-foreground transition-colors">Wiki</button>
            {breadcrumb.map((crumb, i) => (
              <span key={crumb.id} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                <button
                  onClick={() => setSelectedDoc(crumb.id)}
                  className={`hover:text-foreground transition-colors ${i === breadcrumb.length - 1 ? "text-foreground font-medium" : ""}`}
                >
                  {crumb.title}
                </button>
              </span>
            ))}
          </nav>
        )}

        {selected ? (
          <InlineDocEditor
            key={selected.id}
            doc={selected}
            allDocs={docs}
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
              <p className="text-sm">Select a page or create a new one</p>
              {isAdmin && (
                <Button variant="outline" size="sm" className="mt-3" onClick={handleCreateDoc}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Create New Page
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

function InlineDocEditor({ doc, allDocs, isAdmin, onUpdate, onDelete, childDocs, onSelectChild }: {
  doc: Doc; allDocs: Doc[]; isAdmin: boolean; onUpdate: (updates: Partial<Doc>) => void; onDelete: () => void; childDocs: Doc[]; onSelectChild: (id: string) => void;
}) {
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState(doc.content);
  const [tags, setTags] = useState<string[]>(doc.tags);
  const [tagInput, setTagInput] = useState("");
  const [visibility, setVisibility] = useState<Visibility>(doc.visibility);
  const [sharedWith, setSharedWith] = useState<SharedWith>(doc.sharedWith);
  const [parentId, setParentId] = useState<string | null>(doc.parentId);
  const [accessOpen, setAccessOpen] = useState(false);

  const possibleParents = allDocs.filter(d => d.id !== doc.id && d.parentId !== doc.id);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setTitle(doc.title); setContent(doc.content); setTags(doc.tags); setTagInput(""); setVisibility(doc.visibility); setSharedWith(doc.sharedWith); setParentId(doc.parentId); }, [doc.id]);

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

  const handleAccessChange = (newVis: Visibility, newShared: SharedWith) => {
    setVisibility(newVis);
    setSharedWith(newShared);
    onUpdate({ visibility: newVis, sharedWith: newShared });
  };

  return (
    <div className="max-w-none">
      <DocCover
        coverUrl={doc.cover_url}
        icon={doc.icon}
        editable={isAdmin}
        onChange={(updates) => onUpdate(updates as Partial<Doc>)}
      />
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          {isAdmin ? (
            <input value={title} onChange={(e) => { setTitle(e.target.value); scheduleAutoSave({ title: e.target.value }); }} className="text-2xl font-bold tracking-tight bg-transparent border-none outline-none w-full placeholder:text-muted-foreground/50 focus:ring-0" placeholder="Untitled" />
          ) : (
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          )}
          <div className="flex items-center gap-1 shrink-0">
            {isAdmin && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete} title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
          <span>{doc.author}</span><span>·</span><span>Updated {doc.updatedAt}</span>
          <span>·</span>
          {isAdmin ? (
            <button onClick={() => setAccessOpen(!accessOpen)} className="flex items-center gap-1 hover:text-foreground transition-colors">
              <Shield className="h-3 w-3" />
              <span className="capitalize">{visibility}</span>
            </button>
          ) : (
            <span className="capitalize">{visibility}</span>
          )}
          {isAdmin && (
            <>
              <span>·</span>
              <Select value={parentId || "none"} onValueChange={(v) => { const newParent = v === "none" ? null : v; setParentId(newParent); onUpdate({ parentId: newParent }); }}>
                <SelectTrigger className="h-6 w-auto gap-1 border-none shadow-none px-1 text-xs text-muted-foreground hover:text-foreground">
                  <SelectValue placeholder="No parent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent (root)</SelectItem>
                  {possibleParents.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>

        {/* Access Picker (collapsible, post-creation) */}
        {isAdmin && accessOpen && (
          <div className="mt-3 p-3 border rounded-lg bg-muted/30">
            <AccessPicker visibility={visibility} sharedWith={sharedWith} onChange={handleAccessChange} />
          </div>
        )}

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
            <div className="flex items-center gap-0.5">
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
              {tagInput.trim() && (
                <button onClick={() => addTag(tagInput)} className="text-muted-foreground hover:text-foreground">
                  <Plus className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {isAdmin ? (
        <RichTextEditor content={content} onChange={(c) => { setContent(c); scheduleAutoSave({ content: c }); }} placeholder="Start writing..." borderless />
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

      <BacklinksPanel entityId={doc.id} />
    </div>
  );
}
