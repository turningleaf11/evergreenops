import { Palette } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Curated hue set — the same tone families StatusPill draws from, plus a
// few extra brand hues, so a custom stage color never looks like it
// escaped the design system's palette.
const SWATCHES = [
  { label: "Neutral",  hsl: "220 12% 55%" },
  { label: "Azure",    hsl: "215 80% 55%" },
  { label: "Emerald",  hsl: "152 65% 42%" },
  { label: "Amber",    hsl: "32 92% 52%" },
  { label: "Red",      hsl: "0 72% 52%" },
  { label: "Violet",   hsl: "262 65% 60%" },
  { label: "Mint",     hsl: "168 60% 45%" },
  { label: "Tangerine",hsl: "22 90% 56%" },
  { label: "Coral",    hsl: "6 80% 62%" },
  { label: "Purple",   hsl: "280 45% 52%" },
];

export function StageColorPicker({
  value, onChange,
}: { value: string; onChange: (hsl: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="ml-1 rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity shrink-0"
          title="Set column color"
          onClick={e => e.stopPropagation()}
        >
          <Palette className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-2" onClick={e => e.stopPropagation()}>
        <p className="crm-eyebrow mb-2">Column color</p>
        <div className="grid grid-cols-5 gap-1.5">
          {SWATCHES.map(s => (
            <button
              key={s.hsl}
              title={s.label}
              className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: `hsl(${s.hsl})`,
                borderColor: value === s.hsl ? `hsl(${s.hsl})` : "transparent",
                boxShadow: value === s.hsl ? `0 0 0 2px hsl(var(--background)), 0 0 0 3px hsl(${s.hsl})` : undefined,
              }}
              onClick={() => onChange(s.hsl)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
