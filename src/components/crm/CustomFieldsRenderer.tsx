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
  /**
   * "contact" applies the contact-detail visual treatment:
   * - Uppercase muted labels with letter-spacing
   * - Pairs price_range_min + price_range_max into a single PRICE RANGE row
   * - Multi-select chips with checkmark + brand-blue selected state
   * - "Select…" placeholders, Switch for proof_of_funds_on_file, bordered textarea
   * Other entity types keep the default rendering.
   */
  variant?: "default" | "contact";
}

const CONTACT_LABEL_CLS = "text-[11px] font-semibold uppercase mb-1.5 block";
const CONTACT_LABEL_STYLE: React.CSSProperties = {
  letterSpacing: "0.12em",
  color: "#9896B8",
};

export function CustomFieldsRenderer({
  fields,
  values,
  onChange,
  compact,
  variant = "default",
}: RendererProps) {
  if (fields.length === 0) return null;
  const set = (k: string, v: unknown) => onChange({ ...values, [k]: v });
  const isContact = variant === "contact";

  const renderNumber = (f: CustomField, val: unknown, prefix?: string) => (
    <div className="relative">
      {prefix && (
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
          {prefix}
        </span>
      )}
      <Input
        type="number"
        value={(val as number | string) ?? ""}
        onChange={(e) =>
          set(f.field_key, e.target.value === "" ? null : Number(e.target.value))
        }
        className={`${isContact ? "h-9" : "h-8"} text-sm ${prefix ? "pl-6" : ""}`}
      />
    </div>
  );

  const minField = isContact ? fields.find((x) => x.field_key === "price_range_min") : undefined;
  const maxField = isContact ? fields.find((x) => x.field_key === "price_range_max") : undefined;

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {fields.map((f) => {
        const v = values?.[f.field_key];

        // Contact: render combined PRICE RANGE row at price_range_min position; skip max
        if (isContact && f.field_key === "price_range_max" && minField) return null;
        if (isContact && f.field_key === "price_range_min" && maxField) {
          const vMax = values?.["price_range_max"];
          return (
            <div key={f.id}>
              <span className={CONTACT_LABEL_CLS} style={CONTACT_LABEL_STYLE}>
                Price Range
              </span>
              <div className="flex items-center gap-2">
                {renderNumber(f, v, "$")}
                <span className="text-muted-foreground text-sm">—</span>
                {renderNumber(maxField, vMax, "$")}
              </div>
            </div>
          );
        }

        // Contact: proof_of_funds_on_file becomes a Switch row (label left, switch right)
        if (
          isContact &&
          f.field_type === "checkbox" &&
          f.field_key === "proof_of_funds_on_file"
        ) {
          return (
            <div key={f.id} className="flex items-center justify-between py-1">
              <span className={CONTACT_LABEL_CLS + " mb-0"} style={CONTACT_LABEL_STYLE}>
                {f.label}
              </span>
              <Switch checked={!!v} onCheckedChange={(c) => set(f.field_key, !!c)} />
            </div>
          );
        }

        return (
          <div key={f.id}>
            {isContact ? (
              <span className={CONTACT_LABEL_CLS} style={CONTACT_LABEL_STYLE}>
                {f.label}
                {f.required && <span className="text-destructive ml-0.5">*</span>}
              </span>
            ) : (
              <Label className="text-xs flex items-center gap-1">
                {f.label}
                {f.required && <span className="text-destructive">*</span>}
              </Label>
            )}
            {f.field_type === "text" || f.field_type === "url" ? (
              <Input
                type={f.field_type === "url" ? "url" : "text"}
                value={(v as string) ?? ""}
                onChange={(e) => set(f.field_key, e.target.value)}
                className={`${isContact ? "h-9" : "h-8"} text-sm`}
              />
            ) : f.field_type === "number" ? (
              renderNumber(f, v)
            ) : f.field_type === "date" ? (
              <Input
                type="date"
                value={(v as string) ?? ""}
                onChange={(e) => set(f.field_key, e.target.value)}
                className={`${isContact ? "h-9" : "h-8"} text-sm`}
              />
            ) : f.field_type === "textarea" ? (
              <Textarea
                value={(v as string) ?? ""}
                onChange={(e) => set(f.field_key, e.target.value)}
                rows={3}
                className="text-sm bg-background"
                style={
                  isContact
                    ? { border: "1px solid #E5E5E5", borderRadius: 8 }
                    : undefined
                }
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
                <SelectTrigger className={`${isContact ? "h-9" : "h-8"} text-sm`}>
                  <SelectValue placeholder={isContact ? "Select…" : "—"} />
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
                  if (isContact) {
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
                        className="inline-flex items-center gap-1 text-[12px] px-2.5 py-1 rounded-full border transition-colors"
                        style={
                          on
                            ? {
                                background: "#EEF1FC",
                                color: "#3E54D3",
                                borderColor: "#D6DEFB",
                              }
                            : {
                                background: "#FFFFFF",
                                color: "#6B7280",
                                borderColor: "#E0E0E0",
                              }
                        }
                      >
                        {on && <Check className="h-3 w-3" />}
                        {o}
                      </button>
                    );
                  }
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
