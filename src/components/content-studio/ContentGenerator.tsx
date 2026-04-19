import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, ImagePlus, X, Copy, Save, Sparkles, RefreshCw, Wand2 } from "lucide-react";
import { useContentBrands, useContentLibrary } from "@/hooks/useContentStudio";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PLATFORMS = [
  { id: "facebook", label: "Facebook", maxChars: 500 },
  { id: "instagram", label: "Instagram", maxChars: 300 },
  { id: "tiktok", label: "TikTok", maxChars: 200 },
  { id: "linkedin", label: "LinkedIn", maxChars: 700 },
  { id: "blog", label: "Blog outline", maxChars: null as number | null },
];

const MODELS = [
  { id: "google/gemini-2.5-flash", label: "Gemini Flash — fast & cheap" },
  { id: "google/gemini-2.5-pro", label: "Gemini Pro — smarter" },
  { id: "openai/gpt-5-mini", label: "GPT-5 mini — balanced" },
];

export function ContentGenerator() {
  const { brands, loading: brandsLoading } = useContentBrands();
  const { save } = useContentLibrary();
  const fileRef = useRef<HTMLInputElement>(null);

  const [brandId, setBrandId] = useState<string>("");
  const [seed, setSeed] = useState("");
  const [platforms, setPlatforms] = useState<Set<string>>(new Set(["facebook", "instagram", "linkedin"]));
  const [model, setModel] = useState(MODELS[0].id);
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<Record<string, string> | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [canvaResults, setCanvaResults] = useState<Record<string, { url: string | null; loading: boolean }>>({});

  const activeBrand = brands.find((b) => b.id === brandId) || brands[0];

  const togglePlatform = (id: string) => {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      setImageData(ev.target?.result as string);
      setImageName(f.name);
    };
    r.readAsDataURL(f);
  };

  const removeImage = () => {
    setImageData(null);
    setImageName(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const generate = async () => {
    if (!activeBrand) { toast.error("Pick a brand first"); return; }
    if (!seed.trim() && !imageData) { toast.error("Add a seed or image"); return; }
    if (platforms.size === 0) { toast.error("Pick at least one platform"); return; }

    setGenerating(true);
    setResults(null);
    setSavedKeys(new Set());
    setCanvaResults({});

    const selectedPlatforms = PLATFORMS.filter((p) => platforms.has(p.id));

    try {
      const { data, error } = await supabase.functions.invoke("content-generate", {
        body: {
          brand: {
            name: activeBrand.name,
            audience: activeBrand.audience,
            voice: activeBrand.voice,
            mission: activeBrand.mission,
          },
          seed: seed.trim(),
          platforms: selectedPlatforms,
          imageBase64: imageData,
          model,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResults(data.results || {});
    } catch (e: any) {
      toast.error(e?.message || "Generation failed");
    }
    setGenerating(false);
  };

  const handleSave = async (platId: string) => {
    if (!activeBrand || !results) return;
    const plat = PLATFORMS.find((p) => p.id === platId)!;
    const item = await save({
      brand_id: activeBrand.id,
      brand_name: activeBrand.name,
      brand_color: activeBrand.color,
      platform: platId,
      platform_label: plat.label,
      content: results[platId] || "",
      seed: seed.trim(),
      image_url: null,
      status: "draft",
      canva_url: canvaResults[platId]?.url || null,
    });
    if (item) {
      setSavedKeys((s) => new Set(s).add(platId));
      toast.success("Saved to library");
    }
  };

  const handleCopy = async (platId: string) => {
    if (!results) return;
    await navigator.clipboard.writeText(results[platId] || "");
    toast.success("Copied");
  };

  const handleCanva = async (platId: string) => {
    if (!activeBrand || !results) return;
    setCanvaResults((p) => ({ ...p, [platId]: { url: null, loading: true } }));
    try {
      const { data, error } = await supabase.functions.invoke("canva-create", {
        body: {
          brandName: activeBrand.name,
          brandKitId: activeBrand.canva_kit_id,
          platform: platId,
          content: results[platId],
        },
      });
      if (error) throw error;
      setCanvaResults((p) => ({ ...p, [platId]: { url: data?.url || null, loading: false } }));
      if (data?.url) toast.success("Canva graphic ready");
      else toast.message("Sent to Canva — check your designs");
    } catch (e: any) {
      setCanvaResults((p) => ({ ...p, [platId]: { url: null, loading: false } }));
      toast.error(e?.message || "Canva failed");
    }
  };

  if (brandsLoading) return <div className="text-muted-foreground text-sm">Loading brands…</div>;
  if (brands.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground mb-3">No brands yet. Add one in the Brands tab.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Brand picker */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {brands.map((b) => {
          const active = (activeBrand?.id || brands[0].id) === b.id;
          return (
            <button
              key={b.id}
              onClick={() => setBrandId(b.id)}
              className={cn(
                "text-left rounded-xl border p-3 transition-all",
                active ? "border-foreground/40 bg-muted/40" : "border-border hover:bg-muted/30"
              )}
              style={active ? { borderColor: b.color, background: `${b.color}10` } : undefined}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ background: b.color }} />
                <span className="text-sm font-semibold">{b.name}</span>
              </div>
              <div className="text-xs text-muted-foreground line-clamp-1">{b.mission || "—"}</div>
            </button>
          );
        })}
      </div>

      {/* Input */}
      <Card className="p-5">
        <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Drop an image <span className="font-normal lowercase tracking-normal">(optional — AI reads it and writes around it)</span>
        </label>
        <div
          className={cn(
            "rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-all mb-4",
            imageData ? "border-primary bg-primary/5" : "border-border bg-muted/30 hover:border-primary/50 hover:bg-primary/5"
          )}
          onClick={() => !imageData && fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
          {imageData ? (
            <div className="flex items-center gap-3">
              <img src={imageData} alt="" className="w-14 h-14 object-cover rounded-md" />
              <div className="flex-1 text-left min-w-0">
                <div className="text-sm font-semibold text-primary truncate">{imageName}</div>
                <div className="text-xs text-muted-foreground">AI will write content for this image</div>
              </div>
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); removeImage(); }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              <ImagePlus className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground/60" />
              <div className="font-semibold text-foreground">Click to upload a photo</div>
              <div className="text-xs">Property pic, team shot, event — AI analyzes and writes around it</div>
            </div>
          )}
        </div>

        <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Content seed <span className="font-normal lowercase tracking-normal">(optional if image uploaded)</span>
        </label>
        <Textarea
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="Topic, deal update, lesson, question — anything. Keep it casual."
          className="min-h-[80px] resize-none"
        />
        {activeBrand && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {activeBrand.seeds.map((s) => (
              <button
                key={s}
                onClick={() => setSeed(s)}
                className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <div className="flex flex-wrap gap-1.5 flex-1 min-w-[200px]">
            {PLATFORMS.map((p) => {
              const on = platforms.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                    on ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-foreground/30"
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-border bg-background"
          >
            {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <Button onClick={generate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
            Generate
          </Button>
        </div>
      </Card>

      {/* Output */}
      {(generating || results) && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Generated content</h2>
            {results && (
              <Button variant="ghost" size="sm" onClick={generate} disabled={generating}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Regenerate
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {PLATFORMS.filter((p) => platforms.has(p.id)).map((p) => {
              const content = results?.[p.id];
              const charInfo = content ? (p.maxChars ? `${content.length} / ${p.maxChars}` : `${content.length} chars`) : "";
              const showCanva = p.id !== "blog" && p.id !== "tiktok";
              const canva = canvaResults[p.id];
              const saved = savedKeys.has(p.id);
              return (
                <Card key={p.id} className="overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{p.label}</span>
                    {content && (
                      <div className="flex gap-1.5">
                        {showCanva && (
                          <Button size="sm" variant="outline" onClick={() => handleCanva(p.id)} disabled={canva?.loading}>
                            {canva?.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                            Canva
                          </Button>
                        )}
                        <Button size="sm" variant={saved ? "default" : "outline"} onClick={() => handleSave(p.id)} disabled={saved}>
                          <Save className="h-3 w-3 mr-1" /> {saved ? "Saved" : "Save"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleCopy(p.id)}>
                          <Copy className="h-3 w-3 mr-1" /> Copy
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    {!content ? (
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.15s" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.3s" }} />
                      </div>
                    ) : (
                      <>
                        {imageData && p.id !== "blog" && (
                          <Badge variant="secondary" className="mb-2 text-[10px]">Written from your image</Badge>
                        )}
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">{content}</div>
                        <div className="text-xs text-muted-foreground text-right mt-2">{charInfo}</div>
                        {canva?.url && (
                          <a href={canva.url} target="_blank" rel="noreferrer"
                            className="block mt-2 text-xs px-3 py-2 rounded-md bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-300">
                            Graphic created — open in Canva →
                          </a>
                        )}
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
