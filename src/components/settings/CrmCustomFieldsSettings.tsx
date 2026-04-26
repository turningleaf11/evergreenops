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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, GripVertical, Loader2, Settings2, Lock, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { CONTACT_TYPES, CONTACT_TYPE_LABEL, type ContactType } from "@/components/crm/contactTypes";

type Entity = "contact" | "deal" | "company";
type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "multi_select"
  | "checkbox"
  | "url"
  | "tags";

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
  contact_type: string | null;
  is_template: boolean;
  is_deletable: boolean;
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
  { value: "tags", label: "Tags (free-form)" },
];

const ENTITY_LABEL: Record<Entity, string> = {
  contact: "Contacts",
  deal: "Deals",
  company: "Companies",
};

// Contact-type tabs for the contact entity
const CONTACT_TYPE_TABS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  ...CONTACT_TYPES.map((t) => ({ value: t, label: CONTACT_TYPE_LABEL[t] })),
];

// Template fields per contact type — used by the "Load Template Fields" button
const TEMPLATE_FIELDS: Record<string, Omit<Field, "id" | "workspace_id" | "entity_type" | "contact_type">[]> = {
  wholesaler: [
    { field_key: "deal_types", label: "Deal Types", field_type: "multi_select", options: ["SFR", "MF 2-4", "MF 5+", "Commercial", "Land"], required: false, sort_order: 0, is_template: true, is_deletable: false },
    { field_key: "deal_quality", label: "Deal Quality", field_type: "select", options: ["Excellent", "Good", "Average", "Poor"], required: false, sort_order: 1, is_template: true, is_deletable: false },
    { field_key: "reliability_notes", label: "Reliability Notes", field_type: "textarea", options: [], required: false, sort_order: 2, is_template: true, is_deletable: false },
  ],
  broker: [
    { field_key: "deal_types", label: "Deal Types", field_type: "multi_select", options: ["SFR", "MF 2-4", "MF 5+", "Commercial", "Land"], required: false, sort_order: 0, is_template: true, is_deletable: false },
    { field_key: "deal_quality", label: "Deal Quality", field_type: "select", options: ["Excellent", "Good", "Average", "Poor"], required: false, sort_order: 1, is_template: true, is_deletable: false },
    { field_key: "reliability_notes", label: "Reliability Notes", field_type: "textarea", options: [], required: false, sort_order: 2, is_template: true, is_deletable: false },
  ],
  buyer: [
    { field_key: "property_types", label: "Property Types", field_type: "multi_select", options: ["SFR", "MF 2-4", "MF 5+", "Commercial", "Land"], required: false, sort_order: 0, is_template: true, is_deletable: false },
    { field_key: "price_range_min", label: "Price Range Min", field_type: "number", options: [], required: false, sort_order: 1, is_template: true, is_deletable: false },
    { field_key: "price_range_max", label: "Price Range Max", field_type: "number", options: [], required: false, sort_order: 2, is_template: true, is_deletable: false },
    { field_key: "preferred_strategy", label: "Preferred Strategy", field_type: "multi_select", options: ["Fix & Flip", "Buy & Hold", "Wholesale", "BRRRR"], required: false, sort_order: 3, is_template: true, is_deletable: false },
    { field_key: "funding_type", label: "Funding Type", field_type: "select", options: ["Cash", "Hard Money", "Conventional", "Other"], required: false, sort_order: 4, is_template: true, is_deletable: false },
    { field_key: "proof_of_funds_on_file", label: "Proof of Funds on File", field_type: "checkbox", options: [], required: false, sort_order: 5, is_template: true, is_deletable: false },
    { field_key: "closing_speed", label: "Closing Speed", field_type: "select", options: ["7 days", "14 days", "21 days", "30+ days"], required: false, sort_order: 6, is_template: true, is_deletable: false },
    { field_key: "notes", label: "Notes", field_type: "textarea", options: [], required: false, sort_order: 7, is_template: true, is_deletable: false },
  ],
  lender: [
    { field_key: "loan_types", label: "Loan Types", field_type: "multi_select", options: ["Hard Money", "Bridge", "DSCR", "Construction", "Conventional"], required: false, sort_order: 0, is_template: true, is_deletable: false },
    { field_key: "deal_types", label: "Deal Types", field_type: "multi_select", options: ["SFR", "MF 2-4", "MF 5+", "Commercial", "Land"], required: false, sort_order: 1, is_template: true, is_deletable: false },
    { field_key: "min_loan_amount", label: "Min Loan Amount", field_type: "number", options: [], required: false, sort_order: 2, is_template: true, is_deletable: false },
    { field_key: "max_loan_amount", label: "Max Loan Amount", field_type: "number", options: [], required: false, sort_order: 3, is_template: true, is_deletable: false },
    { field_key: "typical_rate_range", label: "Typical Rate Range", field_type: "text", options: [], required: false, sort_order: 4, is_template: true, is_deletable: false },
    { field_key: "points", label: "Points", field_type: "text", options: [], required: false, sort_order: 5, is_template: true, is_deletable: false },
    { field_key: "handles_draws", label: "Handles Draws", field_type: "checkbox", options: [], required: false, sort_order: 6, is_template: true, is_deletable: false },
    { field_key: "markets", label: "Markets", field_type: "tags", options: [], required: false, sort_order: 7, is_template: true, is_deletable: false },
    { field_key: "working_notes", label: "Working Notes", field_type: "textarea", options: [], required: false, sort_order: 8, is_template: true, is_deletable: false },
  ],
  title_agent: [
    { field_key: "states_licensed", label: "States Licensed", field_type: "tags", options: [], required: false, sort_order: 0, is_template: true, is_deletable: false },
    { field_key: "handles_double_closes", label: "Handles Double Closes", field_type: "checkbox", options: [], required: false, sort_order: 1, is_template: true, is_deletable: false },
    { field_key: "creative_friendly", label: "Creative Friendly", field_type: "checkbox", options: [], required: false, sort_order: 2, is_template: true, is_deletable: false },
    { field_key: "average_closing_speed", label: "Average Closing Speed", field_type: "select", options: ["3 days", "5 days", "7 days", "10+ days"], required: false, sort_order: 3, is_template: true, is_deletable: false },
    { field_key: "works_with_investors", label: "Works with Investors", field_type: "checkbox", options: [], required: false, sort_order: 4, is_template: true, is_deletable: false },
    { field_key: "process_notes", label: "Process Notes", field_type: "textarea", options: [], required: false, sort_order: 5, is_template: true, is_deletable: false },
  ],
  attorney: [
    { field_key: "states_licensed", label: "States Licensed", field_type: "tags", options: [], required: false, sort_order: 0, is_template: true, is_deletable: false },
    { field_key: "handles_double_closes", label: "Handles Double Closes", field_type: "checkbox", options: [], required: false, sort_order: 1, is_template: true, is_deletable: false },
    { field_key: "creative_friendly", label: "Creative Friendly", field_type: "checkbox", options: [], required: false, sort_order: 2, is_template: true, is_deletable: false },
    { field_key: "average_closing_speed", label: "Average Closing Speed", field_type: "select", options: ["3 days", "5 days", "7 days", "10+ days"], required: false, sort_order: 3, is_template: true, is_deletable: false },
    { field_key: "works_with_investors", label: "Works with Investors", field_type: "checkbox", options: [], required: false, sort_order: 4, is_template: true, is_deletable: false },
    { field_key: "process_notes", label: "Process Notes", field_type: "textarea", options: [], required: false, sort_order: 5, is_template: true, is_deletable: false },
  ],
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
  const workspace = useWorkspace();
  const workspaceId = workspace.id;
  const [entity, setEntity] = useState<Entity>("contact");
  const [contactTypeTab, setContactTypeTab] = useState<string>("all");
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [seedingTemplate, setSeedingTemplate] = useState(false);

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
    setFields(((data as any[]) || []).map((d) => ({
      ...d,
      options: d.options || [],
      contact_type: d.contact_type ?? null,
      is_template: !!d.is_template,
      is_deletable: d.is_deletable !== false,
    })));
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity]);

  // Filtered list based on contact type tab (only relevant for contact entity)
  const visibleFields = entity === "contact"
    ? (contactTypeTab === "all"
        ? fields
        : fields.filter((f) => f.contact_type === contactTypeTab))
    : fields;

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
    const ct =
      entity === "contact" && contactTypeTab !== "all" ? contactTypeTab : null;
    const { error } = await supabase.from("crm_custom_fields").insert({
      workspace_id: workspaceId,
      entity_type: entity,
      contact_type: ct,
      field_key: slugify(newLabel),
      label: newLabel.trim(),
      field_type: newType,
      options: opts,
      required: false,
      sort_order: visibleFields.length,
      is_template: false,
      is_deletable: true,
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

  const remove = async (f: Field) => {
    if (!f.is_deletable) {
      toast({ title: "Template field", description: "Template fields can't be deleted, only edited.", variant: "destructive" });
      return;
    }
    if (!confirm("Delete this field? Existing data using this field will remain in records.")) return;
    setSavingId(f.id);
    const { error } = await supabase.from("crm_custom_fields").delete().eq("id", f.id);
    setSavingId(null);
    if (error) {
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
      return;
    }
    setFields((prev) => prev.filter((x) => x.id !== f.id));
  };

  const seedTemplate = async () => {
    if (entity !== "contact" || contactTypeTab === "all") return;
    const tmpl = TEMPLATE_FIELDS[contactTypeTab];
    if (!tmpl) {
      toast({ title: "No template available", description: "No template fields defined for this type." });
      return;
    }
    setSeedingTemplate(true);
    const rows = tmpl.map((t) => ({
      workspace_id: workspaceId,
      entity_type: "contact",
      contact_type: contactTypeTab,
      ...t,
      created_by: user?.id ?? null,
    }));
    const { error } = await supabase
      .from("crm_custom_fields")
      .upsert(rows as any, { onConflict: "workspace_id,entity_type,contact_type,field_key" } as any);
    setSeedingTemplate(false);
    if (error) {
      toast({ title: "Couldn't load template", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Template loaded" });
    void load();
  };

  const showTemplateBanner =
    entity === "contact" &&
    contactTypeTab !== "all" &&
    !loading &&
    visibleFields.length === 0 &&
    !!TEMPLATE_FIELDS[contactTypeTab];

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
              {e === "contact" && (
                <Tabs value={contactTypeTab} onValueChange={setContactTypeTab}>
                  <TabsList className="flex-wrap h-auto">
                    {CONTACT_TYPE_TABS.map((t) => (
                      <TabsTrigger key={t.value} value={t.value} className="text-xs">
                        {t.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              )}

              {showTemplateBanner && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      No fields set up for {CONTACT_TYPE_LABEL[contactTypeTab as ContactType]} contacts yet.
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Load default template fields →
                    </p>
                  </div>
                  <Button size="sm" onClick={seedTemplate} disabled={seedingTemplate}>
                    {seedingTemplate ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 mr-1" />
                    )}
                    Load Template Fields
                  </Button>
                </div>
              )}

              {loading ? (
                <div className="text-xs text-muted-foreground py-4 text-center">
                  <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> Loading…
                </div>
              ) : visibleFields.length === 0 && !showTemplateBanner ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No custom fields yet for {ENTITY_LABEL[e].toLowerCase()}
                  {e === "contact" && contactTypeTab !== "all"
                    ? ` of type ${CONTACT_TYPE_LABEL[contactTypeTab as ContactType]}`
                    : ""}
                  .
                </p>
              ) : visibleFields.length > 0 ? (
                <div className="space-y-2">
                  {visibleFields.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center gap-2 rounded-lg border border-border/60 p-2.5"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                      <div className="flex-1 grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4">
                          <div className="flex items-center gap-1.5">
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
                            {f.is_template && (
                              <Badge variant="secondary" className="h-5 px-1.5 gap-0.5 text-[10px]" title="Template field — editable but not deletable">
                                <Lock className="h-2.5 w-2.5" />
                                Template
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                            {f.field_key}
                            {f.contact_type && (
                              <span className="ml-1 text-muted-foreground/70">
                                · {CONTACT_TYPE_LABEL[f.contact_type as ContactType] || f.contact_type}
                              </span>
                            )}
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
                          ) : f.is_deletable ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => remove(f)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <span title="Template field — not deletable">
                              <Lock className="h-3.5 w-3.5 text-muted-foreground/50" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Add new */}
              <div className="rounded-lg border border-dashed border-border/60 p-3 space-y-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Add field
                  {e === "contact" && contactTypeTab !== "all" && (
                    <span className="ml-1 normal-case tracking-normal text-muted-foreground/70">
                      — for {CONTACT_TYPE_LABEL[contactTypeTab as ContactType]} contacts
                    </span>
                  )}
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
