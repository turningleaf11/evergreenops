import { useState } from "react";
import { Clock, Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function presetDate(kind: string): Date {
  const d = new Date();
  switch (kind) {
    case "later_today":
      d.setHours(17, 0, 0, 0);
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
      return d;
    case "tomorrow":
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    case "in_3_days":
      d.setDate(d.getDate() + 3);
      d.setHours(9, 0, 0, 0);
      return d;
    case "next_week":
      d.setDate(d.getDate() + 7);
      d.setHours(9, 0, 0, 0);
      return d;
    default:
      return d;
  }
}

export function FollowUpPicker({
  value,
  onChange,
  trigger,
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(value ? value.slice(0, 16) : "");

  const choose = (kind: string) => {
    const d = presetDate(kind);
    onChange(d.toISOString());
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground px-1 pb-1">
          Follow up
        </div>
        <div className="space-y-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 h-8"
            onClick={() => choose("later_today")}
          >
            <Clock className="h-3.5 w-3.5" /> Later today (5pm)
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 h-8"
            onClick={() => choose("tomorrow")}
          >
            <Clock className="h-3.5 w-3.5" /> Tomorrow 9am
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 h-8"
            onClick={() => choose("in_3_days")}
          >
            <Clock className="h-3.5 w-3.5" /> In 3 days
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 h-8"
            onClick={() => choose("next_week")}
          >
            <Clock className="h-3.5 w-3.5" /> Next week
          </Button>
        </div>
        <div className="border-t border-border/40 mt-2 pt-2 space-y-2">
          <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <CalendarIcon className="h-3 w-3" /> Custom date & time
          </div>
          <Input
            type="datetime-local"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="flex justify-between">
            {value && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            )}
            <Button
              size="sm"
              className="h-7 text-xs ml-auto"
              disabled={!custom}
              onClick={() => {
                onChange(new Date(custom).toISOString());
                setOpen(false);
              }}
            >
              Set
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const TEMPERATURE_META: Record<string, { label: string; dot: string; bg: string; fg: string }> = {
  cold: { label: "Cold", dot: "bg-sky-500", bg: "bg-sky-100", fg: "text-sky-700" },
  warm: { label: "Warm", dot: "bg-amber-500", bg: "bg-amber-100", fg: "text-amber-700" },
  hot:  { label: "Hot",  dot: "bg-red-500",   bg: "bg-red-100",   fg: "text-red-700" },
};
