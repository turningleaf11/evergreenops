import { useState, useEffect, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";

interface GiphyPickerProps {
  onSelect: (url: string) => void;
  children: React.ReactNode;
}

interface GiphyGif {
  id: string;
  images: {
    fixed_height_small: { url: string };
    fixed_height: { url: string };
    original: { url: string };
  };
  title: string;
}

const GIPHY_KEY = "dc6zaTOxFJmzC"; // Giphy public beta key

export function GiphyPicker({ onSelect, children }: GiphyPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Load trending on open
  useEffect(() => {
    if (open && gifs.length === 0 && !query) {
      fetchGifs("trending");
    }
  }, [open]);

  const fetchGifs = async (type: "trending" | "search", q?: string) => {
    setLoading(true);
    try {
      const endpoint = type === "trending"
        ? `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=20&rating=pg`
        : `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q || "")}&limit=20&rating=pg`;
      const res = await fetch(endpoint);
      const json = await res.json();
      setGifs(json.data || []);
    } catch {
      setGifs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.trim()) fetchGifs("search", value);
      else fetchGifs("trending");
    }, 400);
  };

  const handleSelect = (gif: GiphyGif) => {
    onSelect(gif.images.fixed_height.url);
    setOpen(false);
    setQuery("");
    setGifs([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search GIFs..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto">
          {loading && (
            <div className="col-span-2 flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && gifs.map((gif) => (
            <button
              key={gif.id}
              onClick={() => handleSelect(gif)}
              className="rounded-md overflow-hidden hover:ring-2 ring-primary transition-all"
            >
              <img
                src={gif.images.fixed_height_small.url}
                alt={gif.title}
                className="w-full h-24 object-cover"
                loading="lazy"
              />
            </button>
          ))}
          {!loading && gifs.length === 0 && (
            <p className="col-span-2 text-center text-xs text-muted-foreground py-8">No GIFs found</p>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground text-right mt-2 opacity-60">Powered by GIPHY</p>
      </PopoverContent>
    </Popover>
  );
}
