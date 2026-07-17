// SiteBrandingSettings — edit the public inventory site's look (colors + fonts)
// without touching code. Writes the single site_branding row that the site reads
// at runtime; changes appear on the next page render (~1 min ISR).

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const branding = supabase as unknown as { from: (t: string) => any };

const DISPLAY_FONTS = ["Fraunces", "Playfair Display", "Cormorant", "Spectral", "EB Garamond"];
const BODY_FONTS = ["Inter", "Work Sans", "DM Sans", "Manrope", "Nunito Sans"];

// key -> friendly label + hint. Order drives the editor layout.
const COLORS: { key: string; label: string; hint: string }[] = [
  { key: "paper", label: "Background", hint: "Page background" },
  { key: "ink", label: "Text", hint: "Body text" },
  { key: "forest", label: "Primary", hint: "Headings, buttons" },
  { key: "forest_mid", label: "Accent", hint: "Links, highlights" },
  { key: "forest_deep", label: "Primary (hover)", hint: "Button hover" },
  { key: "night", label: "Dark panel", hint: "Buyers-list section" },
  { key: "sage", label: "Muted", hint: "Secondary text" },
  { key: "sage_light", label: "Sage", hint: "Soft fills" },
  { key: "paper_deep", label: "Surface", hint: "Footer" },
  { key: "line", label: "Borders", hint: "Hairlines, cards" },
];

const DEFAULTS: Record<string, string> = {
  paper: "#F9F8F6", paper_deep: "#EFEDE8", ink: "#01041B", night: "#01041B",
  forest: "#288A6D", forest_deep: "#1F6E56", forest_mid: "#1C9E6F",
  sage: "#8FB5A6", sage_light: "#AED2C5", line: "#E6E3DC",
};

const fontHref = (display: string, body: string) =>
  `https://fonts.googleapis.com/css2?family=${encodeURIComponent(display).replace(/%20/g, "+")}:ital,wght@0,400;0,600;1,400;1,600&family=${encodeURIComponent(body).replace(/%20/g, "+")}:wght@400;600&display=swap`;

export function SiteBrandingSettings() {
  const [colors, setColors] = useState<Record<string, string>>(DEFAULTS);
  const [fontDisplay, setFontDisplay] = useState("Fraunces");
  const [fontBody, setFontBody] = useState("Inter");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await branding.from("site_branding").select("colors, font_display, font_body").eq("id", 1).maybeSingle();
    if (data) {
      setColors({ ...DEFAULTS, ...(data.colors ?? {}) });
      setFontDisplay(data.font_display ?? "Fraunces");
      setFontBody(data.font_body ?? "Inter");
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Load the selected fonts so the preview renders them accurately.
  useEffect(() => {
    const id = "branding-preview-fonts";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) { link = document.createElement("link"); link.id = id; link.rel = "stylesheet"; document.head.appendChild(link); }
    link.href = fontHref(fontDisplay, fontBody);
  }, [fontDisplay, fontBody]);

  async function save() {
    setSaving(true);
    const { error } = await branding.from("site_branding")
      .update({ colors, font_display: fontDisplay, font_body: fontBody, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setSaving(false);
    if (error) { toast.error(`Couldn't save: ${error.message}`); return; }
    toast.success("Branding saved — the site updates within a minute");
  }

  function resetDefaults() {
    setColors(DEFAULTS); setFontDisplay("Fraunces"); setFontBody("Inter");
  }

  if (loading) return <div className="h-40 rounded-lg bg-muted/40 animate-pulse" />;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold">Site Branding</h2>
        <p className="text-sm text-muted-foreground">Colors and fonts for the public inventory site. Changes go live within a minute.</p>
      </div>

      {/* Live preview */}
      <div
        className="rounded-2xl border p-6"
        style={{ background: colors.paper, color: colors.ink, borderColor: colors.line, fontFamily: `'${fontBody}', sans-serif` }}
      >
        <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: colors.forest_mid }}>Off-market · Cash</div>
        <div className="mt-1 text-3xl" style={{ fontFamily: `'${fontDisplay}', serif`, color: colors.forest }}>
          Investment property, <span style={{ fontStyle: "italic", color: colors.forest_mid }}>before the market.</span>
        </div>
        <p className="mt-2 text-sm" style={{ opacity: 0.7 }}>Off-market deals for a private list of serious buyers.</p>
        <div className="mt-4 flex items-center gap-3">
          <span className="rounded-full px-4 py-2 text-sm font-medium" style={{ background: colors.forest, color: colors.paper }}>View inventory</span>
          <span className="rounded-full px-4 py-2 text-sm font-medium" style={{ background: colors.night, color: colors.paper }}>Join buyers list</span>
        </div>
      </div>

      {/* Fonts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="crm-field-label">Display font (headings)</Label>
          <Select value={fontDisplay} onValueChange={setFontDisplay}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DISPLAY_FONTS.map((f) => <SelectItem key={f} value={f} style={{ fontFamily: `'${f}', serif` }}>{f}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="crm-field-label">Body font (text)</Label>
          <Select value={fontBody} onValueChange={setFontBody}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{BODY_FONTS.map((f) => <SelectItem key={f} value={f} style={{ fontFamily: `'${f}', sans-serif` }}>{f}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* Colors */}
      <div>
        <Label className="crm-field-label">Colors</Label>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {COLORS.map(({ key, label, hint }) => (
            <div key={key} className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5">
              <input
                type="color"
                value={colors[key] ?? "#000000"}
                onChange={(e) => setColors((c) => ({ ...c, [key]: e.target.value }))}
                className="h-9 w-9 rounded cursor-pointer border border-border shrink-0"
                aria-label={label}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium leading-tight">{label}</div>
                <div className="text-[11px] text-muted-foreground truncate">{hint}</div>
              </div>
              <Input
                value={colors[key] ?? ""}
                onChange={(e) => setColors((c) => ({ ...c, [key]: e.target.value }))}
                className="h-8 w-24 text-xs font-mono uppercase"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/50 pt-4">
        <Button variant="ghost" size="sm" onClick={resetDefaults} className="text-muted-foreground">Reset to Evergreen defaults</Button>
        <Button onClick={save} disabled={saving} className="gap-1.5">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}Save branding
        </Button>
      </div>
    </div>
  );
}

export default SiteBrandingSettings;
