// SiteBrandingSettings — edit the public site's look per element (colors, fonts,
// logo) without touching code. Writes the single site_branding row the site
// reads at runtime; changes appear on the next page render (~1 min ISR).

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, ImagePlus, Type as TypeIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const branding = supabase as unknown as { from: (t: string) => any };
const LOGO_BUCKET = "dispo-property-photos";

const DISPLAY_FONTS = ["Fraunces", "Playfair Display", "Cormorant", "Spectral", "EB Garamond"];
const BODY_FONTS = ["Inter", "Work Sans", "DM Sans", "Manrope", "Nunito Sans"];

const GROUPS: { title: string; items: { key: string; label: string; hint?: string }[] }[] = [
  { title: "Foundation", items: [
    { key: "page", label: "Background", hint: "Page background" },
    { key: "card", label: "Cards", hint: "Card surfaces" },
    { key: "ink", label: "Body text", hint: "Paragraph text" },
    { key: "muted", label: "Muted text", hint: "Secondary text" },
    { key: "line", label: "Borders", hint: "Hairlines" },
    { key: "accent", label: "Accent", hint: "Links, hero accent, tags" },
    { key: "signal", label: "Signal", hint: '"New" badges, header CTA' },
  ] },
  { title: "Sections & tints", items: [
    { key: "soft", label: "Soft section", hint: "How-it-works background" },
    { key: "tint", label: "Early-access banner", hint: "Lime-cream strip" },
    { key: "elevated", label: "Elevated dark", hint: "Inputs on dark panels" },
    { key: "finance", label: "Finance accent", hint: "Creative-finance tag" },
  ] },
  { title: "Headings", items: [
    { key: "heading", label: "Headings", hint: "Section + hero" },
    { key: "subhead", label: "Subheadings", hint: "Listing titles" },
  ] },
  { title: "Buttons", items: [
    { key: "btn", label: "Button fill" },
    { key: "btn_text", label: "Button text" },
    { key: "btn_hover", label: "Button hover" },
  ] },
  { title: "Buyers-list form", items: [
    { key: "panel", label: "Panel background", hint: "Dark CTA section" },
    { key: "panel_text", label: "Panel text" },
    { key: "panel_accent", label: "Panel accent", hint: "Button + highlights" },
  ] },
  { title: "Interested-in-this-deal form", items: [
    { key: "inquiry", label: "Form background" },
    { key: "inquiry_heading", label: "Form heading" },
  ] },
  { title: "Footer", items: [
    { key: "footer", label: "Footer background" },
    { key: "footer_heading", label: "Footer headings" },
    { key: "footer_text", label: "Footer text" },
  ] },
  { title: "Disclaimer", items: [
    { key: "disclaimer", label: "Disclaimer text" },
  ] },
];

const DEFAULTS: Record<string, string> = {
  page: "#F2F3EF", card: "#FFFFFF", ink: "#0B0B0C", muted: "#6B746F", line: "#E3E5E0",
  accent: "#1C9E6F", signal: "#C9FF4A",
  tint: "#DEF99D", soft: "#C4D8D2", elevated: "#141517", finance: "#9ACABA",
  heading: "#0B0B0C", subhead: "#0B0B0C",
  btn: "#1C9E6F", btn_text: "#F2F3EF", btn_hover: "#178A5F",
  panel: "#0B0B0C", panel_text: "#F2F3EF", panel_accent: "#C9FF4A",
  inquiry: "#EAF3EF", inquiry_heading: "#0B0B0C",
  footer: "#0B0B0C", footer_heading: "#C4D8D2", footer_text: "#9BA5A0",
  disclaimer: "#8A928D",
};

const fontHref = (display: string, body: string) =>
  `https://fonts.googleapis.com/css2?family=${encodeURIComponent(display).replace(/%20/g, "+")}:ital,wght@0,400;0,600;1,400;1,600&family=${encodeURIComponent(body).replace(/%20/g, "+")}:wght@400;600&display=swap`;

export function SiteBrandingSettings() {
  const [c, setC] = useState<Record<string, string>>(DEFAULTS);
  const [fontDisplay, setFontDisplay] = useState("Fraunces");
  const [fontBody, setFontBody] = useState("Inter");
  const [logoType, setLogoType] = useState<"text" | "image">("text");
  const [logoText, setLogoText] = useState("Evergreen");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const set = (k: string, v: string) => setC((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    const { data } = await branding.from("site_branding")
      .select("colors, font_display, font_body, logo_type, logo_text, logo_image_url").eq("id", 1).maybeSingle();
    if (data) {
      setC({ ...DEFAULTS, ...(data.colors ?? {}) });
      setFontDisplay(data.font_display ?? "Fraunces");
      setFontBody(data.font_body ?? "Inter");
      setLogoType(data.logo_type === "image" ? "image" : "text");
      setLogoText(data.logo_text ?? "Evergreen");
      setLogoUrl(data.logo_image_url ?? null);
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const id = "branding-preview-fonts";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) { link = document.createElement("link"); link.id = id; link.rel = "stylesheet"; document.head.appendChild(link); }
    link.href = fontHref(fontDisplay, fontBody);
  }, [fontDisplay, fontBody]);

  async function onLogo(file: File) {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `branding/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, { upsert: false });
    setUploading(false);
    if (error) { toast.error(`Upload failed: ${error.message}`); return; }
    setLogoUrl(supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl);
    setLogoType("image");
  }

  async function save() {
    setSaving(true);
    const { error } = await branding.from("site_branding").update({
      colors: c, font_display: fontDisplay, font_body: fontBody,
      logo_type: logoType, logo_text: logoText.trim() || "Evergreen", logo_image_url: logoUrl,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    setSaving(false);
    if (error) { toast.error(`Couldn't save: ${error.message}`); return; }
    toast.success("Branding saved — the site updates within a minute");
  }

  if (loading) return <div className="h-40 rounded-lg bg-muted/40 animate-pulse" />;

  const df = `'${fontDisplay}', serif`;
  const bf = `'${fontBody}', sans-serif`;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold">Site Branding</h2>
        <p className="text-sm text-muted-foreground">Colors, fonts, and logo for the public inventory site. Changes go live within a minute.</p>
      </div>

      {/* Live preview */}
      <div className="rounded-2xl overflow-hidden border" style={{ borderColor: c.line, fontFamily: bf }}>
        <div className="px-5 py-3 flex items-center justify-between" style={{ background: c.page, borderBottom: `1px solid ${c.line}` }}>
          {logoType === "image" && logoUrl
            ? <img src={logoUrl} alt="logo" className="h-6 object-contain" />
            : <span style={{ fontFamily: df, color: c.heading, fontWeight: 600 }}>{logoText || "Evergreen"}</span>}
          <span className="rounded-full px-3 py-1 text-[12px] font-medium" style={{ background: c.btn, color: c.btn_text }}>Join Buyers List</span>
        </div>
        <div className="p-6" style={{ background: c.page }}>
          <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: c.accent }}>Off-market · Cash</div>
          <div className="mt-1 text-3xl" style={{ fontFamily: df, color: c.heading }}>
            Investment property, <span style={{ fontStyle: "italic", color: c.accent }}>before the market.</span>
          </div>
          <div className="mt-4 rounded-xl p-4" style={{ background: c.card, border: `1px solid ${c.line}` }}>
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: df, color: c.heading, fontWeight: 600 }}>$175,000</span>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ background: c.accent, color: c.btn_text }}>For Sale</span>
            </div>
            <div className="mt-1" style={{ color: c.subhead, fontFamily: df }}>Low-Entry SubTo Duplex</div>
            <div className="text-xs" style={{ color: c.muted }}>Tampa, FL · 3 bd · 2 ba</div>
          </div>
        </div>
        <div className="p-5" style={{ background: c.panel, color: c.panel_text }}>
          <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: c.panel_accent }}>Get first dibs</div>
          <div className="mt-1 flex items-center justify-between">
            <span style={{ fontFamily: df }}>Join our VIP Buyers List</span>
            <span className="rounded-full px-3 py-1 text-[12px] font-semibold" style={{ background: c.panel_accent, color: c.panel }}>I Want First Dibs</span>
          </div>
        </div>
        <div className="px-5 py-4" style={{ background: c.footer, color: c.footer_text }}>
          <span style={{ color: c.footer_heading, fontFamily: df }}>Evergreen Real Estate Ventures</span>
          <span className="text-xs"> · Off-market inventory for serious buyers.</span>
        </div>
      </div>

      {/* Logo */}
      <div className="space-y-2">
        <Label className="crm-field-label">Logo (top-left)</Label>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-border p-0.5">
            <button type="button" onClick={() => setLogoType("text")}
              className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm", logoType === "text" ? "bg-brand-azure text-white" : "text-muted-foreground")}>
              <TypeIcon className="h-3.5 w-3.5" /> Wordmark
            </button>
            <button type="button" onClick={() => setLogoType("image")}
              className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm", logoType === "image" ? "bg-brand-azure text-white" : "text-muted-foreground")}>
              <ImagePlus className="h-3.5 w-3.5" /> Image
            </button>
          </div>
          {logoType === "text" ? (
            <Input value={logoText} onChange={(e) => setLogoText(e.target.value)} placeholder="Evergreen" className="h-9 w-52" />
          ) : (
            <div className="flex items-center gap-3">
              {logoUrl && <img src={logoUrl} alt="" className="h-8 object-contain rounded border border-border/50 bg-white px-2" />}
              <input ref={logoRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void onLogo(f); }} />
              <Button variant="outline" size="sm" onClick={() => logoRef.current?.click()} disabled={uploading} className="gap-1.5">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                {logoUrl ? "Replace logo" : "Upload logo"}
              </Button>
            </div>
          )}
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

      {/* Colors, grouped by element */}
      <div className="space-y-5">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">{g.title}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {g.items.map(({ key, label, hint }) => (
                <div key={key} className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5">
                  <input type="color" value={c[key] ?? "#000000"} onChange={(e) => set(key, e.target.value)}
                    className="h-9 w-9 rounded cursor-pointer border border-border shrink-0" aria-label={label} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-tight">{label}</div>
                    {hint && <div className="text-[11px] text-muted-foreground truncate">{hint}</div>}
                  </div>
                  <Input value={c[key] ?? ""} onChange={(e) => set(key, e.target.value)} className="h-8 w-24 text-xs font-mono uppercase" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-border/50 pt-4 sticky bottom-0 bg-background py-3">
        <Button variant="ghost" size="sm" onClick={() => { setC(DEFAULTS); setFontDisplay("Fraunces"); setFontBody("Inter"); }} className="text-muted-foreground">
          Reset to Onyx defaults
        </Button>
        <Button onClick={save} disabled={saving} className="gap-1.5">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}Save branding
        </Button>
      </div>
    </div>
  );
}

export default SiteBrandingSettings;
