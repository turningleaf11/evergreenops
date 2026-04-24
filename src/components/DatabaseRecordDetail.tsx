import { useState, useEffect } from "react";
import type { Database, DatabaseRow, DatabaseColumn } from "@/lib/mock-data";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Save, Mail, Phone, ExternalLink, DollarSign, Check, Type, Hash, Calendar, ListChecks, User as UserIcon, Tag as TagIcon } from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";
import CommentsSection from "@/components/CommentsSection";
import { FieldRow } from "@/components/shared/AccordionField";
import { cn } from "@/lib/utils";

interface DatabaseRecordDetailProps {
  database: Database;
  row: DatabaseRow | null;
  open: boolean;
  onClose: () => void;
  onSave: (values: Record<string, any>) => void;
  onDelete?: () => void;
  allDatabases?: Database[];
  allRows?: DatabaseRow[];
}

const typeIcons: Record<string, React.ElementType> = {
  text: Type, long_text: Type, url: ExternalLink, email: Mail, phone: Phone,
  number: Hash, currency: DollarSign, date: Calendar, status: ListChecks,
  select: ListChecks, multi_select: ListChecks, tags: TagIcon, checkbox: Check,
  progress: Hash, person: UserIcon, file: ExternalLink,
};

export default function DatabaseRecordDetail({ database, row, open, onClose, onSave, onDelete, allDatabases, allRows }: DatabaseRecordDetailProps) {
  const [values, setValues] = useState<Record<string, any>>(row?.values || {});

  useEffect(() => {
    if (open) { setValues(row?.values || {}); }
  }, [open, row]);

  const setValue = (colId: string, val: any) => setValues(prev => ({ ...prev, [colId]: val }));

  const titleVal = (values.title || row?.values.title || "Record") as string;
  const setTitle = (next: string) => setValue("title", next);

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent
        className="w-full sm:max-w-xl overflow-y-auto top-[60px] h-[calc(100vh-60px)] border-l border-border/50 p-6"
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest("[data-radix-popper-content-wrapper], [data-radix-popover-content], [role='dialog'], [role='listbox'], [role='menu']")) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest("[data-radix-popper-content-wrapper], [data-radix-popover-content], [role='dialog'], [role='listbox'], [role='menu']")) {
            e.preventDefault();
          }
        }}
      >
        <SheetHeader>
          <SheetTitle asChild>
            <input
              value={titleVal}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.currentTarget as HTMLInputElement).blur();
                }
              }}
              className="text-lg font-semibold bg-transparent border-0 outline-none focus:ring-0 px-0 py-1 rounded-md hover:bg-muted/30 focus:bg-muted/30 transition-colors w-full pr-8"
            />
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="fields" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="fields" className="flex-1 text-xs">Fields</TabsTrigger>
            <TabsTrigger value="notes" className="flex-1 text-xs">Notes</TabsTrigger>
            {row && <TabsTrigger value="comments" className="flex-1 text-xs">Comments</TabsTrigger>}
          </TabsList>

          <TabsContent value="fields" className="mt-4">
            <div>
              {database.columns.map(col => (
                <FieldRow
                  key={col.id}
                  label={col.name}
                  icon={typeIcons[col.type] || Type}
                  displayValue={renderDisplayValue(col, values[col.id])}
                >
                  <FieldEditor
                    column={col}
                    value={values[col.id]}
                    onChange={v => setValue(col.id, v)}
                  />
                </FieldRow>
              ))}
            </div>
            <div className="flex gap-2 pt-4 mt-4 border-t border-border/30">
              <Button size="sm" onClick={() => onSave(values)}>
                <Save className="h-3.5 w-3.5 mr-1" /> Save
              </Button>
              {onDelete && row && (
                <Button variant="destructive" size="sm" onClick={onDelete}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="notes" className="mt-4">
            <RichTextEditor
              content={values._notes || ""}
              onChange={html => setValue("_notes", html)}
              placeholder="Add notes..."
            />
            <Button size="sm" className="mt-3" onClick={() => onSave(values)}>
              <Save className="h-3.5 w-3.5 mr-1" /> Save
            </Button>
          </TabsContent>

          {row && (
            <TabsContent value="comments" className="mt-4">
              <CommentsSection entityType="database_row" entityId={row.id} />
            </TabsContent>
          )}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function renderDisplayValue(col: DatabaseColumn, value: any): React.ReactNode {
  if (value === null || value === undefined || value === "") return null;
  switch (col.type) {
    case "status":
      return (
        <div className="inline-flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: `hsl(${getStatusColor(value)})` }} />
          <span>{value}</span>
        </div>
      );
    case "tags":
    case "multi_select":
      const arr: string[] = Array.isArray(value) ? value : [];
      if (arr.length === 0) return null;
      return (
        <div className="flex flex-wrap gap-1">
          {arr.slice(0, 3).map(t => <Badge key={t} variant="secondary" className="text-[10px] rounded-full">{t}</Badge>)}
          {arr.length > 3 && <span className="text-xs text-muted-foreground">+{arr.length - 3}</span>}
        </div>
      );
    case "checkbox":
      return value ? <Check className="h-3.5 w-3.5 text-primary" /> : null;
    case "currency":
      return `$${Number(value).toLocaleString()}`;
    case "progress":
      return `${value}%`;
    case "email":
    case "url":
      return <span className="text-primary truncate">{value}</span>;
    default:
      return String(value);
  }
}

function FieldEditor({ column, value, onChange }: { column: DatabaseColumn; value: any; onChange: (v: any) => void }) {
  const toggleMulti = (opt: string) => {
    const current: string[] = Array.isArray(value) ? value : [];
    onChange(current.includes(opt) ? current.filter(v => v !== opt) : [...current, opt]);
  };

  switch (column.type) {
    case "long_text":
      return <Textarea value={value || ""} onChange={e => onChange(e.target.value)} className="text-sm min-h-[80px]" autoFocus />;
    case "currency":
      return (
        <div className="relative">
          <DollarSign className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input type="number" value={value ?? ""} onChange={e => onChange(Number(e.target.value))} className="h-8 text-sm pl-7" autoFocus />
        </div>
      );
    case "email":
      return <Input type="email" value={value || ""} onChange={e => onChange(e.target.value)} className="h-8 text-sm" autoFocus placeholder="email@example.com" />;
    case "phone":
      return <Input type="tel" value={value || ""} onChange={e => onChange(e.target.value)} className="h-8 text-sm" autoFocus />;
    case "status":
    case "select":
      return (
        <div className="space-y-0.5">
          {(column.options || []).map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(
                "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors text-left",
                value === opt ? "bg-primary/10 text-foreground" : "hover:bg-muted text-foreground/80"
              )}
            >
              <span className="flex items-center gap-2">
                {column.type === "status" && (
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: `hsl(${getStatusColor(opt)})` }} />
                )}
                {opt}
              </span>
              {value === opt && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          ))}
        </div>
      );
    case "tags": {
      const tags: string[] = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {tags.map(t => (
              <Badge key={t} variant="secondary" className="text-[10px] gap-1 pr-1">
                {t}
                <button onClick={() => onChange(tags.filter(v => v !== t))}>×</button>
              </Badge>
            ))}
          </div>
          <Input
            placeholder="Add tag + Enter"
            className="h-7 text-xs"
            onKeyDown={e => {
              if (e.key === "Enter") {
                const input = e.currentTarget;
                if (input.value.trim()) {
                  onChange([...tags, input.value.trim()]);
                  input.value = "";
                }
                e.preventDefault();
              }
            }}
          />
        </div>
      );
    }
    case "file":
      return (
        <div className="space-y-1.5">
          <Input value={value || ""} onChange={e => onChange(e.target.value)} placeholder="File URL" className="h-8 text-sm" autoFocus />
          {value && (
            <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> Open file
            </a>
          )}
        </div>
      );
    case "text":
    case "url":
      return <Input value={value || ""} onChange={e => onChange(e.target.value)} className="h-8 text-sm" autoFocus />;
    case "number":
      return <Input type="number" value={value ?? ""} onChange={e => onChange(Number(e.target.value))} className="h-8 text-sm" autoFocus />;
    case "multi_select": {
      const selected: string[] = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-1.5">
          {(column.options || []).map(opt => (
            <button
              key={opt}
              onClick={() => toggleMulti(opt)}
              className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${selected.includes(opt) ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-muted"}`}
            >
              {opt}
            </button>
          ))}
        </div>
      );
    }
    case "date":
      return <Input type="date" value={value || ""} onChange={e => onChange(e.target.value)} className="h-8 text-sm" autoFocus />;
    case "checkbox":
      return (
        <div className="flex items-center gap-2">
          <Checkbox checked={!!value} onCheckedChange={onChange} />
          <span className="text-sm text-muted-foreground">{value ? "Checked" : "Unchecked"}</span>
        </div>
      );
    case "progress": {
      const pct = typeof value === "number" ? value : 0;
      return (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{pct}%</p>
          <Slider value={[pct]} onValueChange={([v]) => onChange(v)} max={100} step={5} className="w-full" />
        </div>
      );
    }
    case "person":
      return <PersonField column={column} value={value} onChange={onChange} />;
    default:
      return <Input value={value || ""} onChange={e => onChange(e.target.value)} className="h-8 text-sm" autoFocus />;
  }
}

function PersonField({ column, value, onChange }: { column: DatabaseColumn; value: any; onChange: (v: any) => void }) {
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null }[]>([]);
  useEffect(() => {
    supabase.from("profiles").select("user_id, full_name").then(({ data }) => { if (data) setProfiles(data); });
  }, []);
  return (
    <div className="space-y-0.5 max-h-60 overflow-y-auto">
      {profiles.map(m => {
        const name = m.full_name || "Unnamed";
        const selected = value === name;
        return (
          <button
            key={m.user_id}
            type="button"
            onClick={() => onChange(name)}
            className={cn(
              "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors text-left",
              selected ? "bg-primary/10 text-foreground" : "hover:bg-muted text-foreground/80"
            )}
          >
            <span>{name}</span>
            {selected && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>
        );
      })}
    </div>
  );
}

const statusColorMap: Record<string, string> = {
  "Not Started": "220 10% 46%",
  "To Do": "220 10% 46%",
  "In Progress": "220 65% 48%",
  "Done": "142 71% 45%",
  "Blocked": "0 72% 51%",
  "Open": "38 92% 50%",
  "Closed": "220 10% 46%",
};

function getStatusColor(val: string): string {
  return statusColorMap[val] || "220 65% 48%";
}
