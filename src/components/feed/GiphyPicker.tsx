import { useState, useEffect, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";

interface GiphyPickerProps {
  onSelect: (url: string) => void;
  children: React.ReactNode;
}

interface TenorGif {
  id: string;
  title: string;
  media_formats: {
    tinygif: { url: string };
    gif: { url: string };
  };
}

const TENOR_KEY = "AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ"; // Google public Tenor API key

export function GiphyPicker({ onSelect, children }: GiphyPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<TenorGif[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open && gifs.length === 0 && !query) {
      fetchGifs("featured");
    }
  }, [open]);

  const fetchGifs = async (type: "featured" | "search", q?: string) => {
    setLoading(true);
    try {
      const endpoint = type === "featured"
        ? `https://tenor.googleapis.com/v2/featured?key=${TENOR_KEY}&limit=20&media_filter=tinygif,gif&contentfilter=medium`
        : `https://tenor.googleapis.com/v2/search?key=${TENOR_KEY}&q=${encodeURIComponent(q || "")}&limit=20&media_filter=tinygif,gif&contentfilter=medium`;
      const res = await fetch(endpoint);
      const json = await res.json();
      setGifs(json.results || []);
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
      else fetchGifs("featured");
    }, 400);
  };

  const handleSelect = (gif: TenorGif) => {
    onSelect(gif.media_formats.gif.url);
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
                src={gif.media_formats.tinygif.url}
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
        <p className="text-[10px] text-muted-foreground text-right mt-2 opacity-60">Powered by Tenor</p>
      </PopoverContent>
    </Popover>
  );
}
