import { useState, useEffect } from "react";
import type { Database, DatabaseRow, DatabaseColumn } from "@/lib/mock-data";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Save, Mail, Phone, ExternalLink, DollarSign } from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";
import CommentsSection from "@/components/CommentsSection";

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

export default function DatabaseRecordDetail({ database, row, open, onClose, onSave, onDelete, allDatabases, allRows }: DatabaseRecordDetailProps) {
  const [values, setValues] = useState<Record<string, any>>(row?.values || {});

  useEffect(() => {
    if (open) setValues(row?.values || {});
  }, [open, row]);

  const setValue = (colId: string, val: any) => setValues(prev => ({ ...prev, [colId]: val }));

  const toggleMulti = (colId: string, opt: string) => {
    const current: string[] = values[colId] || [];
    setValue(colId, current.includes(opt) ? current.filter(v => v !== opt) : [...current, opt]);
  };

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg">{values.title || row?.values.title || "Record"}</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="fields" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="fields" className="flex-1 text-xs">Fields</TabsTrigger>
            <TabsTrigger value="notes" className="flex-1 text-xs">Notes</TabsTrigger>
            {row && <TabsTrigger value="comments" className="flex-1 text-xs">Comments</TabsTrigger>}
          </TabsList>

          <TabsContent value="fields" className="space-y-4 mt-4">
            {database.columns.map(col => (
              <InlineField
                key={col.id}
                column={col}
                value={values[col.id]}
                onChange={v => setValue(col.id, v)}
                onToggleMulti={opt => toggleMulti(col.id, opt)}
                allDatabases={allDatabases}
                allRows={allRows}
              />
            ))}
            <div className="flex gap-2 pt-4 border-t">
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

function InlineField({ column, value, onChange, onToggleMulti, allDatabases, allRows }: {
  column: DatabaseColumn;
  value: any;
  onChange: (v: any) => void;
  onToggleMulti: (opt: string) => void;
  allDatabases?: Database[];
  allRows?: DatabaseRow[];
}) {
  switch (column.type) {
    case "long_text":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{column.name}</Label>
          <Textarea value={value || ""} onChange={e => onChange(e.target.value)} placeholder={column.name} className="text-sm min-h-[80px]" />
        </div>
      );
    case "currency":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{column.name}</Label>
          <div className="relative">
            <DollarSign className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input type="number" value={value ?? ""} onChange={e => onChange(Number(e.target.value))} className="h-8 text-sm pl-7" />
          </div>
        </div>
      );
    case "email":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{column.name}</Label>
          <div className="relative">
            <Mail className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input type="email" value={value || ""} onChange={e => onChange(e.target.value)} className="h-8 text-sm pl-7" placeholder="email@example.com" />
          </div>
        </div>
      );
    case "phone":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{column.name}</Label>
          <div className="relative">
            <Phone className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input type="tel" value={value || ""} onChange={e => onChange(e.target.value)} className="h-8 text-sm pl-7" placeholder="(555) 123-4567" />
          </div>
        </div>
      );
    case "status":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{column.name}</Label>
          <Select value={value || ""} onValueChange={onChange}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={`Select ${column.name}`} /></SelectTrigger>
            <SelectContent>
              {(column.options || []).map(opt => (
                <SelectItem key={opt} value={opt}>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: `hsl(${getStatusColor(opt)})` }} />
                    {opt}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "tags":
      const tags: string[] = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{column.name}</Label>
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
    case "file":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{column.name}</Label>
          <Input value={value || ""} onChange={e => onChange(e.target.value)} placeholder="File URL" className="h-8 text-sm" />
          {value && (
            <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> Open file
            </a>
          )}
        </div>
      );
    case "text":
    case "url":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{column.name}</Label>
          <Input value={value || ""} onChange={e => onChange(e.target.value)} placeholder={column.name} className="h-8 text-sm" />
        </div>
      );
    case "number":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{column.name}</Label>
          <Input type="number" value={value ?? ""} onChange={e => onChange(Number(e.target.value))} className="h-8 text-sm" />
        </div>
      );
    case "select":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{column.name}</Label>
          <Select value={value || ""} onValueChange={onChange}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={`Select ${column.name}`} /></SelectTrigger>
            <SelectContent>
              {(column.options || []).map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    case "multi_select": {
      const selected: string[] = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{column.name}</Label>
          <div className="flex flex-wrap gap-1.5">
            {(column.options || []).map(opt => (
              <button key={opt} onClick={() => onToggleMulti(opt)} className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${selected.includes(opt) ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-muted"}`}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      );
    }
    case "date":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{column.name}</Label>
          <Input type="date" value={value || ""} onChange={e => onChange(e.target.value)} className="h-8 text-sm" />
        </div>
      );
    case "checkbox":
      return (
        <div className="flex items-center gap-2">
          <Checkbox checked={!!value} onCheckedChange={onChange} />
          <Label className="text-xs">{column.name}</Label>
        </div>
      );
    case "progress": {
      const pct = typeof value === "number" ? value : 0;
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{column.name}: {pct}%</Label>
          <Slider value={[pct]} onValueChange={([v]) => onChange(v)} max={100} step={5} className="w-full" />
        </div>
      );
    }
    case "person":
      return <PersonField column={column} value={value} onChange={onChange} />;
    default:
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{column.name}</Label>
          <Input value={value || ""} onChange={e => onChange(e.target.value)} className="h-8 text-sm" />
        </div>
      );
  }
}

function PersonField({ column, value, onChange }: { column: DatabaseColumn; value: any; onChange: (v: any) => void }) {
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null }[]>([]);
  useEffect(() => {
    supabase.from("profiles").select("user_id, full_name").then(({ data }) => { if (data) setProfiles(data); });
  }, []);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{column.name}</Label>
      <Select value={value || ""} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select person" /></SelectTrigger>
        <SelectContent>
          {profiles.map(m => (
            <SelectItem key={m.user_id} value={m.full_name || m.user_id}>{m.full_name || "Unnamed"}</SelectItem>
          ))}
        </SelectContent>
      </Select>
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
