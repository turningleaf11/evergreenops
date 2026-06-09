import { useState, useEffect, useRef } from "react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Rocket, Plus, X, Globe, Smile } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Favorite = {
  id: string;
  label: string;
  url: string;
  sort_order: number;
  custom_icon: string | null;
};

function getFaviconUrl(url: string): string | null {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch {
    return null;
  }
}

function isEmoji(str: string) {
  return /\p{Emoji}/u.test(str.trim()) && str.trim().length <= 4;
}

function ItemIcon({ fav }: { fav: Favorite }) {
  const [imgError, setImgError] = useState(false);

  if (fav.custom_icon && isEmoji(fav.custom_icon)) {
    return (
      <span className="text-2xl leading-none select-none">{fav.custom_icon}</span>
    );
  }

  const faviconSrc = fav.custom_icon || getFaviconUrl(fav.url);

  if (faviconSrc && !imgError) {
    return (
      <img
        src={faviconSrc}
        alt=""
        className="w-6 h-6 object-contain"
        onError={() => setImgError(true)}
      />
    );
  }

  return <Globe className="w-5 h-5 text-muted-foreground" />;
}

export function LauncherMenu() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [icon, setIcon] = useState("");
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_favorites")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true });
    if (data) setFavorites(data as Favorite[]);
  };

  useEffect(() => { if (open) load(); }, [open, user]);

  const handleUrlChange = (val: string) => {
    setUrl(val);
    const favicon = getFaviconUrl(val);
    setFaviconPreview(favicon);
  };

  const add = async () => {
    if (!user || !label.trim() || !url.trim()) return;
    let cleanUrl = url.trim();
    if (!/^https?:\/\//.test(cleanUrl)) cleanUrl = "https://" + cleanUrl;
    const { error } = await supabase.from("user_favorites").insert({
      user_id: user.id,
      label: label.trim(),
      url: cleanUrl,
      sort_order: favorites.length,
      custom_icon: icon.trim() || null,
    });
    if (error) { toast.error(error.message); return; }
    setLabel(""); setUrl(""); setIcon(""); setAdding(false); setFaviconPreview(null); setPickerOpen(false);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("user_favorites").delete().eq("id", id);
    setFavorites(favorites.filter((f) => f.id !== id));
  };

  const closeTimer = useRef<number | null>(null);
  const cancelClose = () => {
    if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = null; }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 300);
  };

  const cancelAdd = () => {
    setAdding(false); setLabel(""); setUrl(""); setIcon(""); setFaviconPreview(null); setPickerOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title="Launcher"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <Rocket className="h-4 w-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 p-3"
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Launcher
          </span>
          {!adding && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => setAdding(true)}
            >
              <Plus className="h-3 w-3" /> Add
            </Button>
          )}
        </div>

        {/* Add form */}
        {adding && (
          <div className="mb-3 rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2">
            {/* URL + favicon preview */}
            <div className="relative">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center">
                {faviconPreview ? (
                  <img
                    src={faviconPreview}
                    alt=""
                    className="w-4 h-4 object-contain"
                    onError={() => setFaviconPreview(null)}
                  />
                ) : (
                  <Globe className="w-3.5 h-3.5 text-muted-foreground/50" />
                )}
              </div>
              <Input
                placeholder="Paste a URL..."
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                className="h-9 pl-8 text-sm bg-background/60"
                autoFocus
              />
            </div>

            <Input
              placeholder="Label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-9 text-sm bg-background/60"
              onKeyDown={(e) => e.key === "Enter" && add()}
            />

            {/* Emoji override */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setPickerOpen((p) => !p)}
                className="flex items-center gap-2 w-full h-9 px-3 rounded-md border border-input bg-background/60 text-sm hover:bg-muted/50 transition-colors"
              >
                {icon ? (
                  <span className="text-lg leading-none">{icon}</span>
                ) : (
                  <Smile className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-muted-foreground text-xs">
                  {icon ? "Emoji override active" : "Pick an emoji icon (optional)"}
                </span>
                {icon && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setIcon(""); }}
                    className="ml-auto text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </button>

              {pickerOpen && (
                <div className="absolute z-50 bottom-full mb-1 right-0" onClick={(e) => e.stopPropagation()}>
                  <Picker
                    data={data}
                    onEmojiSelect={(e: { native: string }) => {
                      setIcon(e.native);
                      setPickerOpen(false);
                    }}
                    theme="auto"
                    previewPosition="none"
                    skinTonePosition="none"
                    navPosition="bottom"
                    perLine={8}
                    maxFrequentRows={2}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-1.5 justify-end pt-0.5">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelAdd}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={add}
                disabled={!label.trim() || !url.trim()}
              >
                Save
              </Button>
            </div>
          </div>
        )}

        {/* Grid */}
        {favorites.length === 0 && !adding ? (
          <div className="py-8 text-center">
            <Rocket className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              No links yet. Add your favorite tools.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-0.5">
            {favorites.map((f) => (
              <div key={f.id} className="group relative flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-muted/60 transition-colors cursor-pointer">
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5 w-full"
                  title={f.url}
                >
                  <div className="w-10 h-10 rounded-xl bg-background border border-border/50 shadow-sm flex items-center justify-center group-hover:border-border transition-colors">
                    <ItemIcon fav={f} />
                  </div>
                  <span className="text-[10px] text-center leading-tight text-foreground/80 max-w-full truncate w-full">
                    {f.label}
                  </span>
                </a>

                {/* Remove button */}
                <button
                  onClick={(e) => { e.preventDefault(); remove(f.id); }}
                  className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center shadow-sm"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
