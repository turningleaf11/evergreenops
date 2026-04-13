import { useState } from "react";
import type { ColumnType, DatabaseColumn } from "@/lib/mock-data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, X, MoreVertical, Pencil, Trash2, ArrowLeft, ArrowRight } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const COLUMN_TYPES: { value: ColumnType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "long_text", label: "Long Text" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "select", label: "Select" },
  { value: "multi_select", label: "Multi Select" },
  { value: "status", label: "Status" },
  { value: "date", label: "Date" },
  { value: "person", label: "Person" },
  { value: "checkbox", label: "Checkbox" },
  { value: "url", label: "URL" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "progress", label: "Progress" },
  { value: "tags", label: "Tags" },
  { value: "file", label: "File" },
  { value: "relation", label: "Relation" },
];

interface AddColumnPopoverProps {
  onAdd: (col: DatabaseColumn) => void;
}

export function AddColumnPopover({ onAdd }: AddColumnPopoverProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ColumnType>("text");
  const [options, setOptions] = useState("");

  const needsOptions = ["select", "multi_select", "status"].includes(type);

  const handleAdd = () => {
    if (!name.trim()) return;
    const col: DatabaseColumn = {
      id: name.trim().toLowerCase().replace(/\s+/g, "_") + "_" + Date.now(),
      name: name.trim(),
      type,
      ...(needsOptions && options.trim() ? { options: options.split(",").map(o => o.trim()).filter(Boolean) } : {}),
    };
    onAdd(col);
    setName("");
    setType("text");
    setOptions("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="p-1.5 hover:bg-muted rounded transition-colors" title="Add column">
          <Plus className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3" align="end">
        <p className="text-sm font-medium">Add Column</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Name</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Column name" className="h-8 text-sm" autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <Select value={type} onValueChange={v => setType(v as ColumnType)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COLUMN_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {needsOptions && (
          <div className="space-y-1.5">
            <Label className="text-xs">Options (comma-separated)</Label>
            <Input value={options} onChange={e => setOptions(e.target.value)} placeholder="Option 1, Option 2" className="h-8 text-sm" />
          </div>
        )}
        <Button size="sm" className="w-full" onClick={handleAdd} disabled={!name.trim()}>Add Column</Button>
      </PopoverContent>
    </Popover>
  );
}

interface ColumnHeaderMenuProps {
  column: DatabaseColumn;
  index: number;
  total: number;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onMoveLeft: (id: string) => void;
  onMoveRight: (id: string) => void;
}

export function ColumnHeaderMenu({ column, index, total, onRename, onDelete, onMoveLeft, onMoveRight }: ColumnHeaderMenuProps) {
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(column.name);

  if (renaming) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          className="h-6 text-xs w-24"
          autoFocus
          onKeyDown={e => {
            if (e.key === "Enter") { onRename(column.id, newName); setRenaming(false); }
            if (e.key === "Escape") setRenaming(false);
          }}
          onBlur={() => { onRename(column.id, newName); setRenaming(false); }}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="truncate">{column.name}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="p-0.5 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreVertical className="h-3 w-3 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuItem onClick={() => { setNewName(column.name); setRenaming(true); }}>
            <Pencil className="h-3 w-3 mr-2" /> Rename
          </DropdownMenuItem>
          {index > 0 && (
            <DropdownMenuItem onClick={() => onMoveLeft(column.id)}>
              <ArrowLeft className="h-3 w-3 mr-2" /> Move Left
            </DropdownMenuItem>
          )}
          {index < total - 1 && (
            <DropdownMenuItem onClick={() => onMoveRight(column.id)}>
              <ArrowRight className="h-3 w-3 mr-2" /> Move Right
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onDelete(column.id)} className="text-destructive">
            <Trash2 className="h-3 w-3 mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
