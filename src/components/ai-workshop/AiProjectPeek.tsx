import { useEffect, useState, useCallback, useRef } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ExternalLink, Github, Copy, Trash2, Plus, X, Upload, FileText, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import RichTextEditor from "@/components/RichTextEditor";
import { AiProjectFeatures } from "@/components/ai-workshop/AiProjectFeatures";
import AccessPicker from "@/components/AccessPicker";
import { uploadFileWithPath, openStoredFile } from "@/lib/file-upload";
import { AI_STAGES, type AiProject, type AiProjectLink } from "./types";
import AiToolsManager, { type AiTool } from "./AiToolsManager";

interface Props {
  projectId: string | null;
  onClose: () => void;
  onChange?: () => void;
}

export default function AiProjectPeek({ projectId, onClose, onChange }: Props) {
  const { user, profile } = useAuth();
  const [project, setProject] = useState<AiProject | null>(null);
  const notesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [links, setLinks] = useState<AiProjectLink[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);
  const [tools, setTools] = useState<AiTool[]>([]);
  const [toolsManagerOpen, setToolsManagerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  const loadTools = useCallback(async () => {
    const { data } = await (supabase.from("ai_tools" as any).select("*").order("name") as any);
    setTools((data as AiTool[]) || []);
  }, []);
  useEffect(() => { if (projectId) loadTools(); }, [projectId, loadTools]);

  const load = useCallback(async () => {
    if (!projectId) return;
    const [p, l, f, pr, c] = await Promise.all([
      (supabase.from("ai_projects" as any).select("*").eq("id", projectId).single() as any),
      (supabase.from("ai_project_links" as any).select("*").eq("project_id", projectId).order("sort_order") as any),
      (supabase.from("ai_project_files" as any).select("*").eq("project_id", projectId).order("created_at", { ascending: false }) as any),
      supabase.from("profiles").select("user_id, full_name"),
      (supabase.from("ai_project_collaborators" as any).select("user_id").eq("project_id", projectId) as any),
    ]);
    if (p.data) setProject(p.data as AiProject);
    if (l.data) setLinks(l.data as AiProjectLink[]);
    if (f.data) setFiles(f.data);
    if (pr.data) setProfiles(pr.data);
    if (c.data) setCollaboratorIds((c.data as any[]).map((r) => r.user_id));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  // Fields visible on the board/list view — only these need to trigger a parent refresh.
  const LIST_VISIBLE_FIELDS = new Set([
    "name", "description", "stage", "platforms", "tags", "live_url", "repo_url", "cover_url",
  ]);

  const update = async (patch: Partial<AiProject>) => {
    if (!project) return;
    setProject({ ...project, ...patch });
    const { error } = await (supabase.from("ai_projects" as any).update(patch).eq("id", project.id) as any);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    // Only refresh the parent list when a visible-on-list field changed.
    // Prevents notes-typing from triggering a full project list refetch + re-render,
    // which was causing the editor to blink/lose state mid-keystroke.
    const touchesList = Object.keys(patch).some((k) => LIST_VISIBLE_FIELDS.has(k));
    if (touchesList) onChange?.();
  };

  const addLink = async () => {
    if (!project) return;
    const { data, error } = await (supabase.from("ai_project_links" as any).insert({
      project_id: project.id, label: "Link", url: "https://", sort_order: links.length,
    }).select().single() as any);
    if (!error && data) setLinks([...links, data as AiProjectLink]);
  };
  const updateLink = async (id: string, patch: Partial<AiProjectLink>) => {
    setLinks(links.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    await (supabase.from("ai_project_links" as any).update(patch).eq("id", id) as any);
  };
  const deleteLink = async (id: string) => {
    setLinks(links.filter((l) => l.id !== id));
    await (supabase.from("ai_project_links" as any).delete().eq("id", id) as any);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, asCover = false) => {
    const selectedFiles = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (selectedFiles.length === 0) return;
    if (!project || !user || !profile?.workspace_id) {
      toast({
        title: "Upload unavailable",
        description: "Your account needs workspace access before files can be attached.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      if (asCover) {
        const file = selectedFiles[0];
        if (!file.type.startsWith("image/")) {
          toast({ title: "Choose an image file", variant: "destructive" });
          return;
        }

        const uploaded = await uploadFileWithPath(file);
        if (!uploaded) {
          toast({ title: "Upload failed", description: file.name, variant: "destructive" });
          return;
        }
        await update({ cover_url: uploaded.publicUrl });
        return;
      }

      const uploadedRows: any[] = [];
      for (const file of selectedFiles) {
        const uploaded = await uploadFileWithPath(file);
        if (!uploaded) {
          toast({ title: "Upload failed", description: file.name, variant: "destructive" });
          continue;
        }

        const { data, error } = await (supabase.from("ai_project_files" as any).insert({
          workspace_id: profile.workspace_id,
          project_id: project.id,
          uploaded_by: user.id,
          name: file.name,
          url: uploaded.publicUrl,
          storage_path: uploaded.path,
          size_bytes: file.size,
          mime_type: file.type || "application/octet-stream",
        }).select().single() as any);

        if (error) {
          toast({ title: "Could not attach file", description: error.message, variant: "destructive" });
        } else if (data) {
          uploadedRows.push(data);
        }
      }

      if (uploadedRows.length > 0) {
        setFiles((current) => [...uploadedRows, ...current]);
      }
    } finally {
      setUploading(false);
    }
  };
  const deleteFile = async (id: string) => {
    setFiles(files.filter((f) => f.id !== id));
    await (supabase.from("ai_project_files" as any).delete().eq("id", id) as any);
  };

  const toggleCollaborator = async (uid: string) => {
    if (!project) return;
    if (collaboratorIds.includes(uid)) {
      setCollaboratorIds(collaboratorIds.filter((x) => x !== uid));
      await (supabase.from("ai_project_collaborators" as any).delete().eq("project_id", project.id).eq("user_id", uid) as any);
    } else {
      setCollaboratorIds([...collaboratorIds, uid]);
      await (supabase.from("ai_project_collaborators" as any).insert({ project_id: project.id, user_id: uid }) as any);
    }
  };

  const togglePlatform = (p: string) => {
    if (!project) return;
    const next = project.platforms.includes(p)
      ? project.platforms.filter((x) => x !== p)
      : [...project.platforms, p];
    update({ platforms: next });
  };

  const handleDelete = async () => {
    if (!project) return;
    if (!confirm("Delete this project? This cannot be undone.")) return;
    await (supabase.from("ai_projects" as any).delete().eq("id", project.id) as any);
    onChange?.();
    onClose();
  };

  if (!projectId) return null;

  return (
    <Sheet open={!!projectId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        {project && (
          <div className="flex flex-col h-full">
            {/* Cover */}
            {project.cover_url ? (
              <div className="relative h-36 bg-muted">
                <img src={project.cover_url} alt="" className="w-full h-full object-cover" />
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute top-2 right-12"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-3 w-3 mr-1" /> {uploading ? "Uploading..." : "Replace"}
                </Button>
              </div>
            ) : (
              <div className="h-12 border-b" />
            )}
            <input ref={coverInputRef} type="file" accept="image/*" hidden onChange={(e) => handleUpload(e, true)} />

            <div className="px-6 py-4 space-y-4 flex-1">
              <div className="flex items-start gap-3">
                <Input
                  value={project.name}
                  onChange={(e) => setProject({ ...project, name: e.target.value })}
                  onBlur={(e) => update({ name: e.target.value })}
                  className="text-2xl font-semibold border-0 px-0 h-auto focus-visible:ring-0 shadow-none"
                />
                <Button variant="ghost" size="icon" onClick={handleDelete}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Select value={project.stage} onValueChange={(v) => update({ stage: v as any })}>
                  <SelectTrigger className="h-7 w-auto px-2 text-xs">
                    <Badge variant="outline" className={AI_STAGES.find((s) => s.id === project.stage)?.color}>
                      {AI_STAGES.find((s) => s.id === project.stage)?.label}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {AI_STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {project.live_url && (
                  <a href={project.live_url} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1 px-2 py-1 rounded-md bg-muted hover:bg-muted/80">
                    <ExternalLink className="h-3 w-3" /> Live
                  </a>
                )}
                {project.repo_url && (
                  <a href={project.repo_url} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1 px-2 py-1 rounded-md bg-muted hover:bg-muted/80">
                    <Github className="h-3 w-3" /> Repo
                  </a>
                )}
              </div>

              <Tabs defaultValue="overview" className="w-full">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="features">Features</TabsTrigger>
                  <TabsTrigger value="prompt">Prompt</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                  <TabsTrigger value="files">Files</TabsTrigger>
                  <TabsTrigger value="access">Access</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4 pt-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Description</Label>
                    <Textarea
                      value={project.description ?? ""}
                      onChange={(e) => setProject({ ...project, description: e.target.value })}
                      onBlur={(e) => update({ description: e.target.value })}
                      placeholder="One line about what this does..."
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Live URL</Label>
                      <Input value={project.live_url ?? ""} onChange={(e) => setProject({ ...project, live_url: e.target.value })} onBlur={(e) => update({ live_url: e.target.value || null })} placeholder="https://..." className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">GitHub Repo</Label>
                      <Input value={project.repo_url ?? ""} onChange={(e) => setProject({ ...project, repo_url: e.target.value })} onBlur={(e) => update({ repo_url: e.target.value || null })} placeholder="https://github.com/..." className="h-9" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Built with</Label>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setToolsManagerOpen(true)}>
                        <Wrench className="h-3 w-3 mr-1" /> Manage stack
                      </Button>
                    </div>
                    <Popover onOpenChange={(o) => o && loadTools()}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 w-full justify-start font-normal">
                          {project.platforms.length ? project.platforms.join(", ") : "Pick tools..."}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-2">
                        <div className="space-y-1 max-h-60 overflow-y-auto">
                          {tools.length === 0 && (
                            <p className="text-xs text-muted-foreground px-2 py-2">No tools in your stack yet.</p>
                          )}
                          {tools.map((t) => (
                            <label key={t.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-xs">
                              <Checkbox checked={project.platforms.includes(t.name)} onCheckedChange={() => togglePlatform(t.name)} />
                              <span className="flex-1 truncate">{t.name}</span>
                            </label>
                          ))}
                        </div>
                        <div className="border-t mt-2 pt-2">
                          <Button variant="ghost" size="sm" className="w-full justify-start h-8 text-xs" onClick={() => setToolsManagerOpen(true)}>
                            <Plus className="h-3 w-3 mr-1.5" /> Add new tool
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tags (comma separated)</Label>
                    <Input
                      value={project.tags.join(", ")}
                      onChange={(e) => setProject({ ...project, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                      onBlur={() => update({ tags: project.tags })}
                      className="h-9"
                      placeholder="internal, experiment"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Other links</Label>
                      <Button variant="ghost" size="sm" onClick={addLink}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                    </div>
                    <div className="space-y-1.5">
                      {links.map((l) => (
                        <div key={l.id} className="flex gap-1.5 items-center">
                          <Input value={l.label} onChange={(e) => setLinks(links.map((x) => x.id === l.id ? { ...x, label: e.target.value } : x))} onBlur={(e) => updateLink(l.id, { label: e.target.value })} placeholder="Label" className="h-8 w-32" />
                          <Input value={l.url} onChange={(e) => setLinks(links.map((x) => x.id === l.id ? { ...x, url: e.target.value } : x))} onBlur={(e) => updateLink(l.id, { url: e.target.value })} placeholder="https://..." className="h-8 flex-1" />
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteLink(l.id)}><X className="h-3 w-3" /></Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Owner</Label>
                    <Select value={project.owner_id ?? ""} onValueChange={(v) => update({ owner_id: v })}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      <SelectContent>
                        {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Unnamed"}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Collaborators</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 w-full justify-start font-normal">
                          {collaboratorIds.length ? `${collaboratorIds.length} people` : "Add teammates..."}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-2">
                        <div className="space-y-1 max-h-60 overflow-y-auto">
                          {profiles.map((p) => (
                            <label key={p.user_id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-xs">
                              <Checkbox checked={collaboratorIds.includes(p.user_id)} onCheckedChange={() => toggleCollaborator(p.user_id)} />
                              {p.full_name || "Unnamed"}
                            </label>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  {!project.cover_url && (
                    <Button variant="outline" size="sm" onClick={() => coverInputRef.current?.click()} disabled={uploading}>
                      <Upload className="h-3 w-3 mr-1.5" /> {uploading ? "Uploading..." : "Add cover image"}
                    </Button>
                  )}
                </TabsContent>

                <TabsContent value="features" className="pt-3">
                  <AiProjectFeatures projectId={project.id} />
                </TabsContent>

                <TabsContent value="prompt" className="space-y-2 pt-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">The prompt / system instructions</Label>
                    <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(project.prompt ?? ""); toast({ title: "Copied" }); }}>
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                  </div>
                  <Textarea
                    value={project.prompt ?? ""}
                    onChange={(e) => setProject({ ...project, prompt: e.target.value })}
                    onBlur={(e) => update({ prompt: e.target.value })}
                    rows={20}
                    placeholder="Paste the prompt that built this..."
                    className="font-mono text-sm"
                  />
                </TabsContent>

                <TabsContent value="notes" className="pt-3">
                  <RichTextEditor
                    content={project.notes_content ?? ""}
                    onChange={(html) => {
                      // Optimistic local state so the editor never lags behind input.
                      setProject((cur) => (cur ? { ...cur, notes_content: html } : cur));
                      // Debounce the DB write so we're not hammering Supabase on every keystroke.
                      if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
                      notesSaveTimer.current = setTimeout(() => {
                        update({ notes_content: html });
                      }, 600);
                    }}
                    placeholder="Brain dump ideas, todos, gotchas..."
                  />
                </TabsContent>

                <TabsContent value="files" className="space-y-3 pt-3">
                  <input ref={filesInputRef} type="file" multiple hidden onChange={(e) => handleUpload(e)} />
                  <Button variant="outline" size="sm" onClick={() => filesInputRef.current?.click()} disabled={uploading}>
                    <Upload className="h-3 w-3 mr-1.5" /> {uploading ? "Uploading..." : "Upload files"}
                  </Button>
                  <div className="space-y-1">
                    {files.length === 0 && <p className="text-xs text-muted-foreground">No files yet.</p>}
                    {files.map((f) => (
                      <div key={f.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 group">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <button onClick={() => openStoredFile(f.url, { fileName: f.name, mimeType: f.mime_type })} className="text-sm flex-1 text-left truncate hover:underline">{f.name}</button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => deleteFile(f.id)}><X className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="access" className="pt-3">
                  <AccessPicker
                    visibility={project.visibility}
                    sharedWith={{ departmentIds: project.shared_department_ids, memberIds: project.shared_member_ids }}
                    onChange={(v, s) => update({ visibility: v, shared_department_ids: s.departmentIds, shared_member_ids: s.memberIds })}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </SheetContent>
      <AiToolsManager open={toolsManagerOpen} onOpenChange={setToolsManagerOpen} onChanged={loadTools} />
    </Sheet>
  );
}
