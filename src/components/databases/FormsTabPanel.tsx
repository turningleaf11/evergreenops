import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Copy, Trash2, ExternalLink, FileText, Globe, Lock, ChevronLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type DBCol = { id: string; name: string; type: string };
type FormField = { column_id: string; label: string; required: boolean; help_text: string };
type FormRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  visibility: "public" | "internal";
  fields: FormField[];
  submit_message: string;
  is_active: boolean;
};

interface Props {
  databaseId: string;
  workspaceId: string;
  columns: DBCol[];
}

function randomSlug() {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return "f_" + btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "").slice(0, 12);
}

function copy(text: string, label = "Copied") {
  navigator.clipboard.writeText(text);
  toast({ title: label });
}

export default function FormsTabPanel({ databaseId, workspaceId, columns }: Props) {
  const [forms, setForms] = useState<FormRow[]>([]);
  const [editing, setEditing] = useState<FormRow | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    const { data } = await supabase
      .from("database_forms")
      .select("*")
      .eq("database_id", databaseId)
      .order("created_at", { ascending: false });
    setForms((data as any) || []);
  };
  useEffect(() => { refresh(); }, [databaseId]);

  const startCreate = () => {
    const draft: FormRow = {
      id: "",
      slug: randomSlug(),
      title: "Untitled form",
      description: "",
      visibility: "internal",
      fields: columns.map(c => ({ column_id: c.id, label: c.name, required: false, help_text: "" })),
      submit_message: "Thanks! Your submission was received.",
      is_active: true,
    };
    setEditing(draft);
    setCreating(true);
  };

  const saveForm = async () => {
    if (!editing) return;
    if (!editing.title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    if (editing.fields.length === 0) { toast({ title: "Pick at least one field", variant: "destructive" }); return; }

    const { data: u } = await supabase.auth.getUser();
    const payload = {
      database_id: databaseId,
      workspace_id: workspaceId,
      slug: editing.slug,
      title: editing.title.trim(),
      description: editing.description,
      visibility: editing.visibility,
      fields: editing.fields as any,
      submit_message: editing.submit_message,
      is_active: editing.is_active,
      created_by: u.user?.id || null,
    };

    if (creating) {
      const { error } = await supabase.from("database_forms").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("database_forms").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    }
    toast({ title: "Form saved" });
    setEditing(null); setCreating(false);
    refresh();
  };

  const deleteForm = async (id: string) => {
    await supabase.from("database_forms").delete().eq("id", id);
    refresh();
  };

  const toggleActive = async (f: FormRow, v: boolean) => {
    await supabase.from("database_forms").update({ is_active: v }).eq("id", f.id);
    refresh();
  };

  const publicUrl = (slug: string) => `${window.location.origin}/f/${slug}`;
  const internalUrl = (slug: string) => `${window.location.origin}/forms/list/${slug}`;

  if (editing) {
    const colsById: Record<string, DBCol> = Object.fromEntries(columns.map(c => [c.id, c]));
    const selectedIds = new Set(editing.fields.map(f => f.column_id));

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setEditing(null); setCreating(false); }}>
            <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back
          </Button>
          <div className="text-sm font-medium">{creating ? "New form" : "Edit form"}</div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Form title</Label>
          <Input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} className="h-9" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Description (optional)</Label>
          <Textarea value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} rows={2} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Visibility</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={editing.visibility === "internal" ? "default" : "outline"}
              size="sm"
              onClick={() => setEditing({ ...editing, visibility: "internal" })}
            >
              <Lock className="h-3.5 w-3.5 mr-1" /> Internal
            </Button>
            <Button
              type="button"
              variant={editing.visibility === "public" ? "default" : "outline"}
              size="sm"
              onClick={() => setEditing({ ...editing, visibility: "public" })}
            >
              <Globe className="h-3.5 w-3.5 mr-1" /> Public link
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {editing.visibility === "public"
              ? "Anyone with the link can submit. No login required."
              : "Only signed-in workspace members can submit."}
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Fields</Label>
          <p className="text-[11px] text-muted-foreground">Pick which columns to include. Drag to reorder.</p>
          <div className="border border-border/40 rounded-md divide-y divide-border/30">
            {columns.map(col => {
              const selected = selectedIds.has(col.id);
              const field = editing.fields.find(f => f.column_id === col.id);
              const idx = editing.fields.findIndex(f => f.column_id === col.id);
              return (
                <div key={col.id} className="p-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selected}
                      onCheckedChange={(c) => {
                        if (c) {
                          setEditing({ ...editing, fields: [...editing.fields, { column_id: col.id, label: col.name, required: false, help_text: "" }] });
                        } else {
                          setEditing({ ...editing, fields: editing.fields.filter(f => f.column_id !== col.id) });
                        }
                      }}
                    />
                    <div className="flex-1 min-w-0 text-sm truncate">{col.name}</div>
                    <Badge variant="secondary" className="text-[10px] font-mono">{col.type}</Badge>
                    {selected && (
                      <>
                        <Button variant="ghost" size="sm" disabled={idx <= 0}
                          onClick={() => {
                            const arr = [...editing.fields];
                            [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
                            setEditing({ ...editing, fields: arr });
                          }}>↑</Button>
                        <Button variant="ghost" size="sm" disabled={idx === editing.fields.length - 1}
                          onClick={() => {
                            const arr = [...editing.fields];
                            [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
                            setEditing({ ...editing, fields: arr });
                          }}>↓</Button>
                      </>
                    )}
                  </div>
                  {selected && field && (
                    <div className="pl-6 space-y-1.5">
                      <Input
                        placeholder="Label shown on form"
                        value={field.label}
                        onChange={e => setEditing({
                          ...editing,
                          fields: editing.fields.map(f => f.column_id === col.id ? { ...f, label: e.target.value } : f),
                        })}
                        className="h-8 text-sm"
                      />
                      <Input
                        placeholder="Help text (optional)"
                        value={field.help_text}
                        onChange={e => setEditing({
                          ...editing,
                          fields: editing.fields.map(f => f.column_id === col.id ? { ...f, help_text: e.target.value } : f),
                        })}
                        className="h-8 text-sm"
                      />
                      <label className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={field.required}
                          onCheckedChange={(c) => setEditing({
                            ...editing,
                            fields: editing.fields.map(f => f.column_id === col.id ? { ...f, required: !!c } : f),
                          })}
                        />
                        Required
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Thank-you message</Label>
          <Textarea value={editing.submit_message} onChange={e => setEditing({ ...editing, submit_message: e.target.value })} rows={2} />
        </div>

        <div className="flex items-center gap-2">
          <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
          <span className="text-xs">{editing.is_active ? "Active" : "Disabled"}</span>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={saveForm} size="sm">Save form</Button>
          <Button variant="ghost" size="sm" onClick={() => { setEditing(null); setCreating(false); }}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium flex items-center gap-1.5"><FileText className="h-4 w-4" /> Forms</div>
          <p className="text-[11px] text-muted-foreground">Create a fillable form. Submissions become new rows in this list.</p>
        </div>
        <Button size="sm" onClick={startCreate}><Plus className="h-3.5 w-3.5 mr-1" /> New form</Button>
      </div>

      {forms.length === 0 && (
        <div className="border border-dashed border-border/50 rounded-md p-6 text-center text-xs text-muted-foreground">
          No forms yet. Create one to collect data into this list.
        </div>
      )}

      {forms.map(f => {
        const url = f.visibility === "public" ? publicUrl(f.slug) : internalUrl(f.slug);
        return (
          <div key={f.id} className="border border-border/40 rounded-md p-3 space-y-2">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{f.title}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant={f.visibility === "public" ? "default" : "secondary"} className="text-[10px]">
                    {f.visibility === "public" ? <><Globe className="h-2.5 w-2.5 mr-1" />Public</> : <><Lock className="h-2.5 w-2.5 mr-1" />Internal</>}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">{f.fields.length} fields</Badge>
                  {!f.is_active && <Badge variant="outline" className="text-[10px]">Disabled</Badge>}
                </div>
              </div>
              <Switch checked={f.is_active} onCheckedChange={(v) => toggleActive(f, v)} />
            </div>
            <div className="flex gap-2 items-center">
              <Input readOnly value={url} className="h-8 text-xs font-mono" />
              <Button size="icon" variant="ghost" onClick={() => copy(url, "Link copied")}><Copy className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" asChild>
                <a href={url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setEditing(f); setCreating(false); }}>Edit</Button>
              <Button variant="ghost" size="sm" onClick={() => deleteForm(f.id)}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
