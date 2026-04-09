import { useState } from "react";
import type { Database, DatabaseRow, DatabaseColumn } from "@/lib/mock-data";
import { teamMembers } from "@/lib/mock-data";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";

interface DatabaseItemEditorProps {
  database: Database;
  row: DatabaseRow | null; // null = creating new
  open: boolean;
  onClose: () => void;
  onSave: (values: Record<string, any>) => void;
  onDelete?: () => void;
}

export default function DatabaseItemEditor({ database, row, open, onClose, onSave, onDelete }: DatabaseItemEditorProps) {
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
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{row ? "Edit Row" : "New Row"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {database.columns.map(col => (
            <FieldEditor key={col.id} column={col} value={values[col.id]} onChange={(v) => setValue(col.id, v)} onToggleMulti={(opt) => toggleMultiSelect(col.id, opt)} multiValues={values[col.id]} />
          ))}
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

function FieldEditor({ column, value, onChange, onToggleMulti, multiValues }: {
  column: DatabaseColumn;
  value: any;
  onChange: (v: any) => void;
  onToggleMulti: (opt: string) => void;
  multiValues?: string[];
}) {
  switch (column.type) {
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
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{column.name}</Label>
          <Select value={value || ""} onValueChange={onChange}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select person" /></SelectTrigger>
            <SelectContent>
              {teamMembers.map(m => (
                <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
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
