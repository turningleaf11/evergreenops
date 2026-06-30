// QuickAddPopover — a button that pops open a small inline composer instead
// of a permanently-visible Input + Button bar sitting above a list. Use this
// for any "add a task / subtask / feature / step" affordance — the
// always-visible bar pattern was found duplicated across five+ surfaces
// before being fixed here once, structurally, instead of per call site.
// Ported from autumn-design-system/src/components/primitives/QuickAddPopover.tsx.

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  onAdd: (value: string) => void;
  /** Trigger button label. Default: "Add". */
  triggerLabel?: string;
  placeholder?: string;
  submitLabel?: string;
}

export function QuickAddPopover({
  onAdd,
  triggerLabel = "Add",
  placeholder = "Name…",
  submitLabel = "Add",
}: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  const submit = () => {
    if (!value.trim()) return;
    onAdd(value.trim());
    setValue("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-3.5 w-3.5 mr-1" /> {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={placeholder}
          autoFocus
          className="text-sm h-8"
        />
        <div className="flex justify-end mt-2">
          <Button size="sm" onClick={submit} disabled={!value.trim()}>{submitLabel}</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
