import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Plus, MoreHorizontal, FileText, Download, Link2, PlayCircle, GripVertical,
  ChevronUp, ChevronDown, Trash2, Users,
} from "lucide-react";
import { toast } from "sonner";
import { uploadFileWithPath, triggerFileInput } from "@/lib/file-upload";
import { EmptyState } from "@/components/shared/EmptyState";

const sb = supabase as any;

type Role = { key: string; label: string; has_tracks: boolean; sort_order: number };
type Track = { key: string; label: string; sort_order: number };
type ResourceKind = "doc" | "file" | "link" | "video";

type Resource = {
  id: string;
  section_id: string;
  title: string;
  description: string | null;
  kind: ResourceKind;
  document_id: string | null;
  url: string | null;
  file_name: string | null;
  tracks: string[];
  sort_order: number;
  published: boolean;
};

type Section = {
  id: string;
  title: string;
  description: string | null;
  role_key: string | null;
  sort_order: number;
  published: boolean;
  resources: Resource[];
};

const KIND_ICON: Record<ResourceKind, React.ElementType> = { doc: FileText, file: Download, link: Link2, video: PlayCircle };
const KIND_LABEL: Record<ResourceKind, string> = { doc: "Doc", file: "File", link: "Link", video: "Video" };

/**
 * Team Hub's editorial surface — shelves addressed to a role, with items
 * inside narrowable to a door. Lives on the Orbit department page behind the
 * same orbit_manage gate as the roster, so there's no new permission to hand
 * out. See supabase/migrations/20260814120000_team_hub_resources.sql for the
 * schema this drives.
 */
export function TeamHubManager() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [addResourceFor, setAddResourceFor] = useState<Section | null>(null);

  const load = async () => {
    const [r, t, s, res] = await Promise.all([
      sb.from("team_roles").select("key, label, has_tracks, sort_order").order("sort_order"),
      sb.from("team_tracks").select("key, label, sort_order").order("sort_order"),
      sb.from("team_hub_sections").select("id, title, description, role_key, sort_order, published").order("sort_order"),
      sb.from("team_hub_resources").select("id, section_id, title, description, kind, document_id, url, file_name, tracks, sort_order, published").order("sort_order"),
    ]);
    setRoles(r.data ?? []);
    setTracks(t.data ?? []);
    const bySection = new Map<string, Resource[]>();
    for (const item of res.data ?? []) {
      bySection.set(item.section_id, [...(bySection.get(item.section_id) ?? []), item]);
    }
    setSections((s.data ?? []).map((sec: any) => ({ ...sec, resources: bySection.get(sec.id) ?? [] })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const roleLabel = (key: string | null) => (key ? roles.find((r) => r.key === key)?.label ?? key : "Everyone");

  const moveSection = async (section: Section, dir: -1 | 1) => {
    const idx = sections.findIndex((s) => s.id === section.id);
    const swapWith = sections[idx + dir];
    if (!swapWith) return;
    await Promise.all([
      sb.from("team_hub_sections").update({ sort_order: swapWith.sort_order }).eq("id", section.id),
      sb.from("team_hub_sections").update({ sort_order: section.sort_order }).eq("id", swapWith.id),
    ]);
    load();
  };

  const toggleSectionPublished = async (section: Section) => {
    await sb.from("team_hub_sections").update({ published: !section.published }).eq("id", section.id);
    load();
  };

  const deleteSection = async (section: Section) => {
    if (!confirm(`Delete "${section.title}" and everything on it?`)) return;
    await sb.from("team_hub_sections").delete().eq("id", section.id);
    toast.success("Shelf deleted");
    load();
  };

  const moveResource = async (resource: Resource, siblings: Resource[], dir: -1 | 1) => {
    const idx = siblings.findIndex((r) => r.id === resource.id);
    const swapWith = siblings[idx + dir];
    if (!swapWith) return;
    await Promise.all([
      sb.from("team_hub_resources").update({ sort_order: swapWith.sort_order }).eq("id", resource.id),
      sb.from("team_hub_resources").update({ sort_order: resource.sort_order }).eq("id", swapWith.id),
    ]);
    load();
  };

  const toggleResourcePublished = async (resource: Resource) => {
    await sb.from("team_hub_resources").update({ published: !resource.published }).eq("id", resource.id);
    load();
  };

  const deleteResource = async (resource: Resource) => {
    if (!confirm(`Remove "${resource.title}" from this shelf?`)) return;
    await sb.from("team_hub_resources").delete().eq("id", resource.id);
    toast.success("Removed");
    load();
  };

  if (loading) return <div className="h-40 animate-pulse rounded-xl bg-muted/40" />;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Shelves</h2>
          <p className="mt-0.5 text-xs text-muted-foreground/70">
            What the field team sees in Team Hub → Resources, addressed by role.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddSectionOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add shelf
        </Button>
      </div>

      {!sections.length ? (
        <EmptyState title="No shelves yet" description="Add one to start populating Team Hub's Resources page." />
      ) : (
        <div className="space-y-4">
          {sections.map((section, i) => (
            <Card key={section.id} className={section.published ? "" : "opacity-60"}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">{roleLabel(section.role_key)}</Badge>
                      {!section.published && <Badge variant="outline" className="text-[10px]">Unpublished</Badge>}
                    </div>
                    <p className="mt-1 font-semibold text-sm">{section.title}</p>
                    {section.description && <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => moveSection(section, -1)}>
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === sections.length - 1} onClick={() => moveSection(section, 1)}>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <Switch checked={section.published} onCheckedChange={() => toggleSectionPublished(section)} />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => deleteSection(section)} className="text-destructive">
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete shelf
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="rounded-lg border divide-y">
                  {section.resources.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-muted-foreground text-center">No resources on this shelf yet.</p>
                  ) : (
                    section.resources.map((r, ri) => {
                      const Icon = KIND_ICON[r.kind];
                      return (
                        <div key={r.id} className={`flex items-center gap-2.5 px-3 py-2 ${r.published ? "" : "opacity-50"}`}>
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="text-sm truncate block">{r.title}</span>
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground uppercase shrink-0">{KIND_LABEL[r.kind]}</span>
                          {r.tracks.map((t) => (
                            <Badge key={t} variant="secondary" className="text-[9px] shrink-0">{t.toUpperCase()}</Badge>
                          ))}
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={ri === 0} onClick={() => moveResource(r, section.resources, -1)}>
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={ri === section.resources.length - 1} onClick={() => moveResource(r, section.resources, 1)}>
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                            <Switch checked={r.published} onCheckedChange={() => toggleResourcePublished(r)} className="scale-75" />
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteResource(r)}>
                              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAddResourceFor(section)}>
                  <Plus className="mr-1 h-3 w-3" /> Add resource
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PeopleRoleAssignment roles={roles} />

      {addSectionOpen && (
        <AddSectionDialog
          roles={roles}
          nextSortOrder={sections.length}
          onClose={() => setAddSectionOpen(false)}
          onCreated={() => { setAddSectionOpen(false); load(); }}
        />
      )}

      {addResourceFor && (
        <AddResourceDialog
          section={addResourceFor}
          tracks={tracks}
          showTracks={roles.find((r) => r.key === addResourceFor.role_key)?.has_tracks ?? false}
          userId={user?.id ?? null}
          onClose={() => setAddResourceFor(null)}
          onCreated={() => { setAddResourceFor(null); load(); }}
        />
      )}
    </div>
  );
}

/* ── add shelf ─────────────────────────────────────────────────────────────── */

function AddSectionDialog({
  roles, nextSortOrder, onClose, onCreated,
}: { roles: Role[]; nextSortOrder: number; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [roleKey, setRoleKey] = useState<string>("__everyone");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const { error } = await sb.from("team_hub_sections").insert({
      title: title.trim(),
      description: description.trim() || null,
      role_key: roleKey === "__everyone" ? null : roleKey,
      sort_order: nextSortOrder,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Shelf added");
    onCreated();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add shelf</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. On a call" autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this shelf is for" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Who sees it</label>
            <Select value={roleKey} onValueChange={setRoleKey}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__everyone">Everyone</SelectItem>
                {roles.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving || !title.trim()} className="w-full">
            {saving ? "Adding…" : "Add shelf"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── add resource ──────────────────────────────────────────────────────────── */

function AddResourceDialog({
  section, tracks, showTracks, userId, onClose, onCreated,
}: {
  section: Section; tracks: Track[]; showTracks: boolean; userId: string | null;
  onClose: () => void; onCreated: () => void;
}) {
  const [kind, setKind] = useState<ResourceKind>("doc");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [docQuery, setDocQuery] = useState("");
  const [docResults, setDocResults] = useState<{ id: string; title: string }[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<{ id: string; title: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (kind !== "doc" || docQuery.trim().length < 2) { setDocResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb.from("documents").select("id, title").ilike("title", `%${docQuery.trim()}%`).limit(8);
      setDocResults(data ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [kind, docQuery]);

  const toggleTrack = (key: string) => {
    setSelectedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    const base = {
      section_id: section.id,
      description: description.trim() || null,
      kind,
      tracks: Array.from(selectedTracks),
      sort_order: section.resources.length,
      created_by: userId,
    };

    if (kind === "doc") {
      if (!selectedDoc) { toast.error("Pick or create a doc first"); setSaving(false); return; }
      const { error } = await sb.from("team_hub_resources").insert({ ...base, title: selectedDoc.title, document_id: selectedDoc.id });
      setSaving(false);
      if (error) { toast.error(error.message); return; }
    } else if (kind === "file") {
      if (!file) { toast.error("Choose a file first"); setSaving(false); return; }
      const uploaded = await uploadFileWithPath(file);
      if (!uploaded) { toast.error("Upload failed"); setSaving(false); return; }
      const { error } = await sb.from("team_hub_resources").insert({
        ...base, title: title.trim() || file.name, url: uploaded.publicUrl,
        storage_path: uploaded.path, file_name: file.name, file_size: file.size, mime_type: file.type || null,
      });
      setSaving(false);
      if (error) { toast.error(error.message); return; }
    } else {
      if (!title.trim() || !url.trim()) { toast.error("Title and URL are both required"); setSaving(false); return; }
      const { error } = await sb.from("team_hub_resources").insert({ ...base, title: title.trim(), url: url.trim() });
      setSaving(false);
      if (error) { toast.error(error.message); return; }
    }

    toast.success("Resource added");
    onCreated();
  };

  const createNewDoc = async () => {
    const t = docQuery.trim();
    if (!t) return;
    const { data: userData } = await sb.auth.getUser();
    const { data, error } = await sb.from("documents").insert({
      title: t, content: "", tags: [], visibility: "workspace",
      author_id: userData?.user?.id ?? null, author_name: userData?.user?.email ?? null,
    }).select("id, title").single();
    if (error) { toast.error(error.message); return; }
    setSelectedDoc(data);
    setDocQuery("");
    setDocResults([]);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add resource to "{section.title}"</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-4 gap-1.5">
            {(["doc", "file", "link", "video"] as ResourceKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-md border px-2 py-2 text-xs font-medium capitalize transition-colors ${
                  kind === k ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>

          {kind === "doc" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Find or write a doc</label>
              {selectedDoc ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="truncate">{selectedDoc.title}</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelectedDoc(null)}>Change</Button>
                </div>
              ) : (
                <>
                  <Input value={docQuery} onChange={(e) => setDocQuery(e.target.value)} placeholder="Search documents…" />
                  {docResults.length > 0 && (
                    <div className="rounded-md border divide-y max-h-40 overflow-y-auto">
                      {docResults.map((d) => (
                        <button key={d.id} type="button" onClick={() => { setSelectedDoc(d); setDocQuery(""); setDocResults([]); }}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-muted truncate">
                          {d.title}
                        </button>
                      ))}
                    </div>
                  )}
                  {docQuery.trim().length >= 2 && (
                    <Button variant="outline" size="sm" className="h-7 text-xs w-full" onClick={createNewDoc}>
                      <Plus className="mr-1 h-3 w-3" /> Create new doc "{docQuery.trim()}"
                    </Button>
                  )}
                </>
              )}
            </div>
          )}

          {kind === "file" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">File</label>
              {file ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="truncate">{file.name}</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setFile(null)}>Change</Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="w-full" onClick={() => triggerFileInput("*", setFile)}>
                  Choose file
                </Button>
              )}
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Display title (defaults to filename)" />
            </div>
          )}

          {(kind === "link" || kind === "video") && (
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "video" ? "e.g. Skip Tracing Walkthrough" : "e.g. Open your pipeline in GHL"} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">{kind === "video" ? "Embed URL (Loom / YouTube)" : "URL"}</label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
              </div>
            </div>
          )}

          {kind !== "file" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
          )}

          {showTracks && tracks.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Narrow to a door (leave blank for every door)</label>
              <div className="flex flex-wrap gap-3 mt-1.5">
                {tracks.map((t) => (
                  <label key={t.key} className="flex items-center gap-1.5 text-sm">
                    <Checkbox checked={selectedTracks.has(t.key)} onCheckedChange={() => toggleTrack(t.key)} />
                    {t.key.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? "Adding…" : "Add resource"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── people → role assignment ─────────────────────────────────────────────── */

function PeopleRoleAssignment({ roles }: { roles: Role[] }) {
  const [people, setPeople] = useState<{ user_id: string; full_name: string | null; role_key: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sb.from("profiles").select("user_id, full_name, role_key").order("full_name").then(({ data }: any) => {
      setPeople(data ?? []);
      setLoading(false);
    });
  }, []);

  const setRole = async (userId: string, roleKey: string) => {
    const value = roleKey === "__none" ? null : roleKey;
    await sb.from("profiles").update({ role_key: value }).eq("user_id", userId);
    setPeople((prev) => prev.map((p) => (p.user_id === userId ? { ...p, role_key: value } : p)));
  };

  return (
    <div>
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <Users className="h-3.5 w-3.5" /> Who's what role
      </h2>
      <p className="mt-0.5 mb-3 text-xs text-muted-foreground/70">
        A person's role controls which shelves they see. Door (DTS/DTA/etc.) still comes from Orbit membership.
      </p>
      {loading ? (
        <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
      ) : (
        <div className="rounded-lg border divide-y max-h-72 overflow-y-auto">
          {people.map((p) => (
            <div key={p.user_id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-sm truncate">{p.full_name || "Unnamed"}</span>
              <Select value={p.role_key ?? "__none"} onValueChange={(v) => setRole(p.user_id, v)}>
                <SelectTrigger className="h-7 w-48 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No role</SelectItem>
                  {roles.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
