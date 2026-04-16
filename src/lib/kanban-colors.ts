// Static class maps so Tailwind JIT picks them up.

export type KanbanColorName =
  | "slate" | "blue" | "red" | "green" | "amber"
  | "indigo" | "violet" | "rose" | "cyan" | "pink";

export const KANBAN_COLORS: KanbanColorName[] = [
  "slate", "blue", "indigo", "violet", "pink", "rose", "red", "amber", "green", "cyan",
];

interface ColorClasses {
  headerBg: string;     // soft tint pill background
  headerText: string;   // deep text
  columnBg: string;     // even softer column body bg
  stripe: string;       // 3px top stripe on cards (solid-ish)
  swatch: string;       // solid color swatch (for picker)
}

export const KANBAN_CLASSES: Record<KanbanColorName, ColorClasses> = {
  slate:  { headerBg: "bg-slate-500/15",  headerText: "text-slate-700 dark:text-slate-300",   columnBg: "bg-slate-500/5",  stripe: "bg-slate-500",  swatch: "bg-slate-500" },
  blue:   { headerBg: "bg-blue-500/15",   headerText: "text-blue-700 dark:text-blue-300",     columnBg: "bg-blue-500/5",   stripe: "bg-blue-500",   swatch: "bg-blue-500" },
  indigo: { headerBg: "bg-indigo-500/15", headerText: "text-indigo-700 dark:text-indigo-300", columnBg: "bg-indigo-500/5", stripe: "bg-indigo-500", swatch: "bg-indigo-500" },
  violet: { headerBg: "bg-violet-500/15", headerText: "text-violet-700 dark:text-violet-300", columnBg: "bg-violet-500/5", stripe: "bg-violet-500", swatch: "bg-violet-500" },
  pink:   { headerBg: "bg-pink-500/15",   headerText: "text-pink-700 dark:text-pink-300",     columnBg: "bg-pink-500/5",   stripe: "bg-pink-500",   swatch: "bg-pink-500" },
  rose:   { headerBg: "bg-rose-500/15",   headerText: "text-rose-700 dark:text-rose-300",     columnBg: "bg-rose-500/5",   stripe: "bg-rose-500",   swatch: "bg-rose-500" },
  red:    { headerBg: "bg-red-500/15",    headerText: "text-red-700 dark:text-red-300",       columnBg: "bg-red-500/5",    stripe: "bg-red-500",    swatch: "bg-red-500" },
  amber:  { headerBg: "bg-amber-500/15",  headerText: "text-amber-700 dark:text-amber-300",   columnBg: "bg-amber-500/5",  stripe: "bg-amber-500",  swatch: "bg-amber-500" },
  green:  { headerBg: "bg-green-500/15",  headerText: "text-green-700 dark:text-green-300",   columnBg: "bg-green-500/5",  stripe: "bg-green-500",  swatch: "bg-green-500" },
  cyan:   { headerBg: "bg-cyan-500/15",   headerText: "text-cyan-700 dark:text-cyan-300",     columnBg: "bg-cyan-500/5",   stripe: "bg-cyan-500",   swatch: "bg-cyan-500" },
};

export function resolveColor(name?: string): KanbanColorName {
  if (name && (KANBAN_COLORS as string[]).includes(name)) return name as KanbanColorName;
  return "slate";
}

// Map an HSL token (used by databases option colors) to the closest named palette color.
export function hslToKanbanColor(hsl?: string): KanbanColorName {
  if (!hsl) return "slate";
  const m = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!m) return "slate";
  const h = parseInt(m[1], 10);
  const s = parseInt(m[2], 10);
  if (s < 20) return "slate";
  if (h < 15) return "red";
  if (h < 35) return "amber";
  if (h < 55) return "amber";
  if (h < 100) return "green";
  if (h < 180) return "cyan";
  if (h < 220) return "blue";
  if (h < 260) return "indigo";
  if (h < 290) return "violet";
  if (h < 330) return "pink";
  return "rose";
}

export function kanbanColorToHsl(c: KanbanColorName): string {
  // Approximate HSL for storing back into databases option colors.
  const map: Record<KanbanColorName, string> = {
    slate: "220 10% 46%", blue: "220 65% 48%", indigo: "243 75% 58%",
    violet: "262 83% 58%", pink: "330 81% 60%", rose: "0 72% 51%",
    red: "0 72% 51%", amber: "38 92% 50%", green: "142 71% 45%", cyan: "188 86% 43%",
  };
  return map[c];
}
