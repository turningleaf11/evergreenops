import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Upload, Link2, Search, Loader2, ImageIcon } from "lucide-react";
import { uploadFile } from "@/lib/file-upload";
import { COLOR_PRESETS, GRADIENT_PRESETS, PHOTO_PRESETS } from "@/lib/cover-presets";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (coverUrl: string | null) => void;
  hasCover: boolean;
}

interface UnsplashResult {
  id: string;
  thumb: string;
  full: string;
  author: string;
  authorUrl: string;
}

export default function CoverPickerDialog({ open, onOpenChange, onSelect, hasCover }: Props) {
  const pick = (value: string | null) => {
    onSelect(value);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-base">Change cover</DialogTitle>
          {hasCover && (
            <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-muted-foreground mr-8" onClick={() => pick(null)}>
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
          )}
        </DialogHeader>

        <Tabs defaultValue="gallery" className="w-full">
          <div className="px-6 border-b">
            <TabsList className="h-10 p-0 gap-4 bg-transparent">
              <TabsTrigger value="gallery" className="px-0 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Gallery</TabsTrigger>
              <TabsTrigger value="upload"  className="px-0 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Upload</TabsTrigger>
              <TabsTrigger value="link"    className="px-0 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Link</TabsTrigger>
              <TabsTrigger value="unsplash"className="px-0 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Unsplash</TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6 max-h-[60vh] overflow-y-auto">
            <TabsContent value="gallery" className="mt-0 space-y-5">
              <Section title="Colors & gradients">
                <div className="grid grid-cols-6 gap-2">
                  {[...GRADIENT_PRESETS, ...COLOR_PRESETS].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => pick(p.value)}
                      className="aspect-[3/2] rounded-lg ring-1 ring-border hover:ring-2 hover:ring-primary transition-all"
                      style={p.value.startsWith("gradient:")
                        ? { backgroundImage: p.value.slice("gradient:".length) }
                        : { backgroundColor: p.value.slice("color:".length) }}
                      title={p.label}
                      type="button"
                    />
                  ))}
                </div>
              </Section>
              <Section title="Photos">
                <div className="grid grid-cols-4 gap-2">
                  {PHOTO_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => pick(p.full)}
                      className="aspect-[3/2] rounded-lg overflow-hidden ring-1 ring-border hover:ring-2 hover:ring-primary transition-all"
                      type="button"
                      title={p.label}
                    >
                      <img src={p.thumb} alt={p.label} className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              </Section>
            </TabsContent>

            <TabsContent value="upload" className="mt-0">
              <UploadTab onUploaded={pick} />
            </TabsContent>

            <TabsContent value="link" className="mt-0">
              <LinkTab onSubmit={pick} />
            </TabsContent>

            <TabsContent value="unsplash" className="mt-0">
              <UnsplashTab onSelect={pick} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{title}</h3>
      {children}
    </div>
  );
}

function UploadTab({ onUploaded }: { onUploaded: (url: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);

  const handle = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setUploading(true);
    const url = await uploadFile(file);
    setUploading(false);
    if (url) onUploaded(url);
    else toast.error("Upload failed");
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault(); setDrag(false);
        const f = e.dataTransfer.files?.[0]; if (f) handle(f);
      }}
      onClick={() => ref.current?.click()}
      className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-2 cursor-pointer transition-colors ${drag ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
    >
      {uploading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
      <p className="text-sm font-medium">{uploading ? "Uploading…" : "Drop an image, or click to browse"}</p>
      <p className="text-xs text-muted-foreground">PNG, JPG, WebP up to 20MB</p>
      <input
        ref={ref} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); e.currentTarget.value = ""; }}
      />
    </div>
  );
}

function LinkTab({ onSubmit }: { onSubmit: (url: string) => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const submit = async () => {
    setError(null);
    if (!/^https?:\/\//i.test(url)) { setError("Enter a valid URL starting with http(s)://"); return; }
    setChecking(true);
    const ok = await new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
    setChecking(false);
    if (!ok) { setError("Couldn't load that image"); return; }
    onSubmit(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste an image URL…"
            className="pl-9"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
        <Button onClick={submit} disabled={!url || checking}>
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">Works best with images at least 1500 pixels wide.</p>
    </div>
  );
}

function UnsplashTab({ onSelect }: { onSelect: (url: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UnsplashResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unsplash-search?q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      });
      const json = await res.json();
      if (json.configured === false) { setConfigured(false); setResults([]); return; }
      setConfigured(true);
      if (json.error) { setError(json.error); setResults([]); return; }
      setResults(json.results || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { search(""); }, []);

  if (configured === false) {
    return (
      <div className="text-center py-12 space-y-2">
        <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="text-sm font-medium">Unsplash isn't connected yet</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Add an <code className="px-1 py-0.5 rounded bg-muted">UNSPLASH_ACCESS_KEY</code> in backend secrets to enable photo search. The other tabs work fine.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search(query)}
          placeholder="Search Unsplash photos…"
          className="pl-9"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelect(r.full)}
              className="group relative aspect-[3/2] rounded-lg overflow-hidden ring-1 ring-border hover:ring-2 hover:ring-primary transition-all"
              title={`Photo by ${r.author}`}
            >
              <img src={r.thumb} alt={r.author} className="w-full h-full object-cover" loading="lazy" />
              <span className="absolute bottom-0 inset-x-0 px-1.5 py-0.5 text-[10px] text-white bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity truncate text-left">
                {r.author}
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground text-center">Photos via Unsplash</p>
    </div>
  );
}
