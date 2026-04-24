import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, GripVertical, Loader2, Settings2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Entity = "contact" | "deal" | "company";
type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "multi_select"
  | "checkbox"
  | "url";

interface Field {
  id: string;
  workspace_id: string | null;
  entity_type: Entity;
  field_key: string;
  label: string;
  field_type: FieldType;
  options: string[];
  required: boolean;
  sort_order: number;
}

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Single line text" },
  { value: "textarea", label: "Multi-line text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "url", label: "URL" },
  { value: "checkbox", label: "Checkbox" },
  { value: "select", label: "Single select" },
  { value: "multi_select", label: "Multi select" },
];

const ENTITY_LABEL: Record<Entity, string> = {
  contact: "Contacts",
  deal: "Deals",
  company: "Companies",
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || `field_${Date.now().toString(36)}`;
}

export function CrmCustomFieldsSettings() {
  const { user } = useAuth();
  const workspace = useWorkspace() as any;
  const workspaceId = workspace?.workspace?.id ?? workspace?.id ?? null;
  const [entity, setEntity] = useState<Entity>("contact");
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // new field form
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<FieldType>("text");
  const [newOptions, setNewOptions] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("crm_custom_fields")
      .select("*")
      .eq("entity_type", entity)
      .order("sort_order");
    setFields(((data as any[]) || []).map((d) => ({ ...d, options: d.options || [] })));
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity]);

  const create = async () => {
    if (!newLabel.trim()) {
      toast({ title: "Label required", variant: "destructive" });
      return;
    }
    const needsOptions = newType === "select" || newType === "multi_select";
    const opts = needsOptions
      ? newOptions
          .split(/[,\n]/)
          .map((o) => o.trim())
          .filter(Boolean)
      : [];
    if (needsOptions && opts.length === 0) {
      toast({ title: "Add at least one option", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("crm_custom_fields").insert({
      workspace_id: workspaceId,
      entity_type: entity,
      field_key: slugify(newLabel),
      label: newLabel.trim(),
      field_type: newType,
      options: opts,
      required: false,
      sort_order: fields.length,
      created_by: user?.id ?? null,
    } as any);
    setCreating(false);
    if (error) {
      toast({
        title: "Couldn't create field",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setNewLabel("");
    setNewOptions("");
    setNewType("text");
    void load();
  };

  const update = async (id: string, patch: Partial<Field>) => {
    setSavingId(id);
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    const { error } = await supabase.from("crm_custom_fields").update(patch as any).eq("id", id);
    setSavingId(null);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      void load();
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this field? Existing data using this field will remain in records.")) return;
    setSavingId(id);
    const { error } = await supabase.from("crm_custom_fields").delete().eq("id", id);
    setSavingId(null);
    if (error) {
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
      return;
    }
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Settings2 className="h-4 w-4" /> CRM Custom Fields
        </CardTitle>
        <CardDescription>
          Define extra fields collected on Contacts, Deals, and Companies. Available immediately
          throughout the CRM, including the email "Link to CRM" quick-create.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={entity} onValueChange={(v) => setEntity(v as Entity)}>
          <TabsList>
            {(Object.keys(ENTITY_LABEL) as Entity[]).map((e) => (
              <TabsTrigger key={e} value={e}>
                {ENTITY_LABEL[e]}
              </TabsTrigger>
            ))}
          </TabsList>

          {(Object.keys(ENTITY_LABEL) as Entity[]).map((e) => (
            <TabsContent key={e} value={e} className="space-y-3 pt-3">
              {loading ? (
                <div className="text-xs text-muted-foreground py-4 text-center">
                  <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> Loading…
                </div>
              ) : fields.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No custom fields yet for {ENTITY_LABEL[e].toLowerCase()}.
                </p>
              ) : (
                <div className="space-y-2">
                  {fields.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center gap-2 rounded-lg border border-border/60 p-2.5"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                      <div className="flex-1 grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4">
                          <Input
                            value={f.label}
                            onChange={(ev) =>
                              setFields((p) =>
                                p.map((x) => (x.id === f.id ? { ...x, label: ev.target.value } : x)),
                              )
                            }
                            onBlur={() => update(f.id, { label: f.label })}
                            className="h-8 text-sm"
                          />
                          <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                            {f.field_key}
                          </div>
                        </div>
                        <div className="col-span-3">
                          <Select
                            value={f.field_type}
                            onValueChange={(v) => update(f.id, { field_type: v as FieldType })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FIELD_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value} className="text-xs">
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-3">
                          {(f.field_type === "select" || f.field_type === "multi_select") && (
                            <Input
                              value={(f.options || []).join(", ")}
                              onChange={(ev) =>
                                setFields((p) =>
                                  p.map((x) =>
                                    x.id === f.id
                                      ? {
                                          ...x,
                                          options: ev.target.value
                                            .split(",")
                                            .map((s) => s.trim())
                                            .filter(Boolean),
                                        }
                                      : x,
                                  ),
                                )
                              }
                              onBlur={() => update(f.id, { options: f.options })}
                              placeholder="Option 1, Option 2"
                              className="h-8 text-xs"
                            />
                          )}
                        </div>
                        <div className="col-span-1 flex items-center gap-1.5">
                          <Switch
                            checked={f.required}
                            onCheckedChange={(c) => update(f.id, { required: !!c })}
                          />
                          <span className="text-[10px] text-muted-foreground">req</span>
                        </div>
                        <div className="col-span-1 flex justify-end">
                          {savingId === f.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => remove(f.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new */}
              <div className="rounded-lg border border-dashed border-border/60 p-3 space-y-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Add field
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-5">
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={newLabel}
                      onChange={(ev) => setNewLabel(ev.target.value)}
                      placeholder="e.g. Lead source"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">Type</Label>
                    <Select value={newType} onValueChange={(v) => setNewType(v as FieldType)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value} className="text-xs">
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-4">
                    {(newType === "select" || newType === "multi_select") && (
                      <>
                        <Label className="text-xs">Options</Label>
                        <Input
                          value={newOptions}
                          onChange={(ev) => setNewOptions(ev.target.value)}
                          placeholder="Comma-separated"
                          className="h-8 text-sm"
                        />
                      </>
                    )}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={create} disabled={creating}>
                    {creating ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5 mr-1" />
                    )}
                    Add field
                  </Button>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
