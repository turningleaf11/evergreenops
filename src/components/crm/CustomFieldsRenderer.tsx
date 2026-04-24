import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
    | "textarea";
  options: string[];
  required: boolean;
  sort_order: number;
}

export function useCustomFields(entityType: "contact" | "deal" | "company") {
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
      if (active) {
        setFields((data as any[])?.map((d) => ({ ...d, options: d.options || [] })) || []);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [entityType]);

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
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
