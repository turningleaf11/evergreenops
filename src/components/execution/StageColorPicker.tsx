// Curated hue set — the same tone families StatusPill draws from, plus a
// few extra brand hues, so a custom stage color never looks like it
// escaped the design system's palette.
export const STAGE_COLOR_SWATCHES = [
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

export function StageColorSwatchGrid({
  value, onChange,
}: { value: string; onChange: (hsl: string) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1.5 p-1">
      {STAGE_COLOR_SWATCHES.map(s => (
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
  );
}
