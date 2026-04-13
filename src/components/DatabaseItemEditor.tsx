import { useState, useEffect } from "react";
import type { Database, DatabaseRow, DatabaseColumn } from "@/lib/mock-data";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { X } from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";

interface DatabaseItemEditorProps {
  database: Database;
  row: DatabaseRow | null;
  open: boolean;
  onClose: () => void;
  onSave: (values: Record<string, any>) => void;
  onDelete?: () => void;
  /** For relation column lookups */
  allDatabases?: Database[];
  allRows?: DatabaseRow[];
}

export default function DatabaseItemEditor({ database, row, open, onClose, onSave, onDelete, allDatabases, allRows }: DatabaseItemEditorProps) {
  const [values, setValues] = useState<Record<string, any>>(row?.values || {});

  const handleOpen = (isOpen: boolean) => {
    if (!isOpen) onClose();
    else setValues(row?.values || {});
  };

  const setValue = (colId: string, val: any) => {
    setValues(prev => ({ ...prev, [colId]: val }));
  };

  const toggleMultiSelect = (colId: string, option: string) => {
    const current: string[] = values[colId] || [];
    setValue(colId, current.includes(option) ? current.filter(v => v !== option) : [...current, option]);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{row ? "Edit Row" : "New Row"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {database.columns.map(col => (
            <FieldEditor
              key={col.id}
              column={col}
              value={values[col.id]}
              onChange={(v) => setValue(col.id, v)}
              onToggleMulti={(opt) => toggleMultiSelect(col.id, opt)}
              multiValues={values[col.id]}
              allDatabases={allDatabases}
              allRows={allRows}
            />
          ))}
          <div className="space-y-1.5 pt-2 border-t">
            <Label className="text-xs font-medium">Notes</Label>
            <RichTextEditor content={values._notes || ""} onChange={(html) => setValue("_notes", html)} placeholder="Add notes or details..." />
          </div>
        </div>
        <DialogFooter className="flex gap-2">
          {onDelete && row && (
            <Button variant="destructive" size="sm" onClick={onDelete} className="mr-auto">Delete</Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => onSave(values)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RelationEditor({ column, value, onChange, allDatabases, allRows }: {
  column: DatabaseColumn;
  value: any;
  onChange: (v: any) => void;
  allDatabases?: Database[];
  allRows?: DatabaseRow[];
}) {
  const [search, setSearch] = useState("");
  const config = column.relationConfig;
  if (!config || !allRows) return null;

  const targetRows = allRows.filter(r => r.databaseId === config.databaseId);
  const targetDb = allDatabases?.find(d => d.id === config.databaseId);

  const isMultiple = config.multiple;
  const selectedIds: string[] = isMultiple
    ? (Array.isArray(value) ? value : [])
    : (value ? [value] : []);

  const filteredOptions = targetRows.filter(r =>
    !selectedIds.includes(r.id) &&
    (r.values.title || "").toLowerCase().includes(search.toLowerCase())
  );

  const removeId = (id: string) => {
    if (isMultiple) {
      onChange(selectedIds.filter(v => v !== id));
    } else {
      onChange(null);
    }
  };

  const addId = (id: string) => {
    if (isMultiple) {
      onChange([...selectedIds, id]);
    } else {
      onChange(id);
    }
    setSearch("");
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{column.name} {targetDb && <span className="text-muted-foreground">→ {targetDb.title}</span>}</Label>
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedIds.map(id => {
            const row = targetRows.find(r => r.id === id);
            return (
              <Badge key={id} variant="secondary" className="text-xs gap-1 pr-1">
                {row?.values.title || "Unknown"}
                <button onClick={() => removeId(id)} className="ml-0.5 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
      <div className="relative">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${targetDb?.title || "items"}...`}
          className="h-8 text-sm"
        />
        {search && filteredOptions.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
            {filteredOptions.slice(0, 8).map(r => (
              <button
                key={r.id}
                onClick={() => addId(r.id)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                {r.values.title || "Untitled"}
              </button>
            ))}
          </div>
        )}
        {search && filteredOptions.length === 0 && (
          <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md p-2 text-xs text-muted-foreground">
            No matching items
          </div>
        )}
      </div>
    </div>
  );
}

function FieldEditor({ column, value, onChange, onToggleMulti, multiValues, allDatabases, allRows }: {
  column: DatabaseColumn;
  value: any;
  onChange: (v: any) => void;
  onToggleMulti: (opt: string) => void;
  multiValues?: string[];
  allDatabases?: Database[];
  allRows?: DatabaseRow[];
}) {
  switch (column.type) {
    case "relation":
      return <RelationEditor column={column} value={value} onChange={onChange} allDatabases={allDatabases} allRows={allRows} />;
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
              {(column.options || []).map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "multi_select":
      const selected: string[] = Array.isArray(multiValues) ? multiValues : [];
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
    case "date":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{column.name}</Label>
          <Input type="date" value={value || ""} onChange={e => onChange(e.target.value)} className="h-8 text-sm" />
        </div>
      );
    case "person":
      return <PersonEditor column={column} value={value} onChange={onChange} />;
    case "checkbox":
      return (
        <div className="flex items-center gap-2">
          <Checkbox checked={!!value} onCheckedChange={onChange} />
          <Label className="text-xs">{column.name}</Label>
        </div>
      );
    case "progress":
      const pct = typeof value === "number" ? value : 0;
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{column.name}: {pct}%</Label>
          <Slider value={[pct]} onValueChange={([v]) => onChange(v)} max={100} step={5} className="w-full" />
        </div>
      );
    default:
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{column.name}</Label>
          <Input value={value || ""} onChange={e => onChange(e.target.value)} className="h-8 text-sm" />
        </div>
      );
  }
}

function PersonEditor({ column, value, onChange }: { column: DatabaseColumn; value: any; onChange: (v: any) => void }) {
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