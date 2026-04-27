import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface CustomField {
  id: string;
  field_key: string;
  label: string;
  field_type:
    | "text"
    | "number"
    | "date"
    | "select"
    | "multi_select"
    | "checkbox"
    | "url"
    | "textarea"
    | "tags";
  options: string[];
  required: boolean;
  sort_order: number;
  contact_type?: string | null;
  is_template?: boolean;
  is_deletable?: boolean;
}

export function useCustomFields(
  entityType: "contact" | "deal" | "company",
  contactType?: string | null,
) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("crm_custom_fields")
        .select("*")
        .eq("entity_type", entityType)
        .order("sort_order");
      if (!active) return;
      const all = (data as any[])?.map((d) => ({ ...d, options: d.options || [] })) || [];
      // For non-contact entities, return everything as before.
      // For contacts, filter to: matching type + null type (global), templates first, then custom.
      let filtered = all;
      if (entityType === "contact") {
        filtered = all.filter((f) => !f.contact_type || f.contact_type === contactType);
        filtered.sort((a, b) => {
          // Same-type templates first, then same-type custom, then global (null type)
          const score = (f: any) => {
            if (f.contact_type === contactType && f.is_template) return 0;
            if (f.contact_type === contactType) return 1;
            return 2;
          };
          const s = score(a) - score(b);
          return s !== 0 ? s : (a.sort_order ?? 0) - (b.sort_order ?? 0);
        });
      }
      setFields(filtered);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [entityType, contactType]);

  return { fields, loading };
}

interface RendererProps {
  fields: CustomField[];
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  compact?: boolean;
}

export function CustomFieldsRenderer({ fields, values, onChange, compact }: RendererProps) {
  if (fields.length === 0) return null;
  const set = (k: string, v: unknown) => onChange({ ...values, [k]: v });

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {fields.map((f) => {
        const v = values?.[f.field_key];
        return (
          <div key={f.id}>
            <Label className="text-xs flex items-center gap-1">
              {f.label}
              {f.required && <span className="text-destructive">*</span>}
            </Label>
            {f.field_type === "text" || f.field_type === "url" ? (
              <Input
                type={f.field_type === "url" ? "url" : "text"}
                value={(v as string) ?? ""}
                onChange={(e) => set(f.field_key, e.target.value)}
                className="h-8 text-sm"
              />
            ) : f.field_type === "number" ? (
              <Input
                type="number"
                value={(v as number | string) ?? ""}
                onChange={(e) => set(f.field_key, e.target.value === "" ? null : Number(e.target.value))}
                className="h-8 text-sm"
              />
            ) : f.field_type === "date" ? (
              <Input
                type="date"
                value={(v as string) ?? ""}
                onChange={(e) => set(f.field_key, e.target.value)}
                className="h-8 text-sm"
              />
            ) : f.field_type === "textarea" ? (
              <Textarea
                value={(v as string) ?? ""}
                onChange={(e) => set(f.field_key, e.target.value)}
                rows={3}
                className="text-sm"
              />
            ) : f.field_type === "checkbox" ? (
              <div className="pt-1">
                <Checkbox
                  checked={!!v}
                  onCheckedChange={(c) => set(f.field_key, !!c)}
                />
              </div>
            ) : f.field_type === "select" ? (
              <Select
                value={(v as string) ?? ""}
                onValueChange={(val) => set(f.field_key, val)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {(f.options || []).map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : f.field_type === "multi_select" ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(f.options || []).map((o) => {
                  const arr = Array.isArray(v) ? (v as string[]) : [];
                  const on = arr.includes(o);
                  return (
                    <button
                      key={o}
                      type="button"
                      onClick={() =>
                        set(
                          f.field_key,
                          on ? arr.filter((x) => x !== o) : [...arr, o],
                        )
                      }
                      className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                        on
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:border-foreground/30"
                      }`}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
            ) : f.field_type === "tags" ? (
              <TagsInput
                value={Array.isArray(v) ? (v as string[]) : []}
                onChange={(next) => set(f.field_key, next)}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function TagsInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    if (value.includes(t)) {
      setDraft("");
      return;
    }
    onChange([...value, t]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      {value.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border"
        >
          {t}
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onChange(value.filter((x) => x !== t))}
            aria-label={`Remove ${t}`}
          >
            ×
          </button>
        </span>
      ))}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={add}
        placeholder="Add tag…"
        className="h-7 w-32 text-xs"
      />
    </div>
  );
}
