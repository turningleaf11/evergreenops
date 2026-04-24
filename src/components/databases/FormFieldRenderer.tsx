import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

export type RenderField = {
  column_id: string;
  name: string;
  type: string;
  options?: any;
  label: string;
  help_text?: string;
  required: boolean;
};

interface Props {
  field: RenderField;
  value: any;
  onChange: (v: any) => void;
}

export function FormFieldRenderer({ field, value, onChange }: Props) {
  const id = `f-${field.column_id}`;
  const opts: string[] = Array.isArray(field.options) ? field.options.map((o: any) => typeof o === "string" ? o : o?.value || o?.label) : [];

  let control: React.ReactNode;
  switch (field.type) {
    case "long-text":
    case "long_text":
    case "textarea":
      control = <Textarea id={id} value={value || ""} onChange={e => onChange(e.target.value)} rows={4} />;
      break;
    case "number":
      control = <Input id={id} type="number" value={value ?? ""} onChange={e => onChange(e.target.value === "" ? "" : Number(e.target.value))} />;
      break;
    case "date":
      control = <Input id={id} type="date" value={value || ""} onChange={e => onChange(e.target.value)} />;
      break;
    case "email":
      control = <Input id={id} type="email" value={value || ""} onChange={e => onChange(e.target.value)} />;
      break;
    case "url":
      control = <Input id={id} type="url" value={value || ""} onChange={e => onChange(e.target.value)} />;
      break;
    case "phone":
      control = <Input id={id} type="tel" value={value || ""} onChange={e => onChange(e.target.value)} />;
      break;
    case "checkbox":
      control = (
        <label className="flex items-center gap-2">
          <Checkbox id={id} checked={!!value} onCheckedChange={(c) => onChange(!!c)} />
          <span className="text-sm">Yes</span>
        </label>
      );
      break;
    case "select":
    case "single-select":
    case "single_select":
      control = (
        <select
          id={id}
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">Choose…</option>
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
      break;
    case "multi-select":
    case "multi_select":
    case "tags": {
      const arr: string[] = Array.isArray(value) ? value : [];
      control = (
        <div className="space-y-2">
          {opts.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {opts.map(o => {
                const sel = arr.includes(o);
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => onChange(sel ? arr.filter(x => x !== o) : [...arr, o])}
                    className={`px-2.5 py-1 rounded-full text-xs border ${sel ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1">
                {arr.map(t => (
                  <Badge key={t} variant="secondary" className="text-xs">
                    {t}
                    <button type="button" className="ml-1" onClick={() => onChange(arr.filter(x => x !== t))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Input
                placeholder="Type and press Enter"
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (v && !arr.includes(v)) onChange([...arr, v]);
                    (e.target as HTMLInputElement).value = "";
                  }
                }}
              />
            </>
          )}
        </div>
      );
      break;
    }
    default:
      control = <Input id={id} value={value || ""} onChange={e => onChange(e.target.value)} />;
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">
        {field.label} {field.required && <span className="text-destructive">*</span>}
      </Label>
      {field.help_text && <p className="text-xs text-muted-foreground">{field.help_text}</p>}
      {control}
    </div>
  );
}
