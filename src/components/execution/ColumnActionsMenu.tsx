import { MoreHorizontal, Palette } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { StageColorSwatchGrid } from "@/components/execution/StageColorPicker";

// Column header actions, ClickUp-style: hidden until the header is
// hovered, then a single "⋯" reveals a real menu. "Change color" is the
// only item today, but this is deliberately a menu container (not a
// button that jumps straight to the swatches) so more column actions —
// hide, rename, etc. — have somewhere to land later without a redesign.
export function ColumnActionsMenu({
  color, onColorChange,
}: { color: string; onColorChange: (hsl: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="ml-0.5 rounded p-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity shrink-0"
          title="Column actions"
          onClick={e => e.stopPropagation()}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={e => e.stopPropagation()}>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette className="h-3.5 w-3.5 mr-2" /> Change color
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <StageColorSwatchGrid value={color} onChange={onColorChange} />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
