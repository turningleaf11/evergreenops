import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ImageIcon, Smile, Trash2, Upload } from "lucide-react";
import { uploadFile } from "@/lib/file-upload";
import { Input } from "@/components/ui/input";

const EMOJI_PRESETS = [
  "📄","📘","📗","📕","📓","📔","📒","📚","🗂️","🗒️","📝","✏️",
  "💡","🚀","🎯","⭐","🔥","✨","🌱","🌟","🛠️","🧭","🗺️","🧠",
  "📊","📈","📌","📎","🔖","🔍","🔑","🛡️","🏗️","🏛️","🏆","💰",
];

interface Props {
  coverUrl: string | null;
  icon: string | null;
  editable: boolean;
  onChange: (updates: { cover_url?: string | null; icon?: string | null }) => void;
}

export default function DocCover({ coverUrl, icon, editable, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    const url = await uploadFile(file);
    setUploading(false);
    if (url) onChange({ cover_url: url });
  };

  return (
    <div className="group/cover">
      {coverUrl ? (
        <div className="relative -mx-6 lg:-mx-16 mb-4">
          <div
            className="w-full h-44 md:h-56 bg-cover bg-center"
            style={{ backgroundImage: `url(${coverUrl})` }}
          />
          {editable && (
            <div className="absolute top-3 right-4 flex gap-1.5 opacity-0 group-hover/cover:opacity-100 transition-opacity">
              <Button size="sm" variant="secondary" className="h-7 text-xs gap-1.5 backdrop-blur-md bg-background/80" onClick={() => fileRef.current?.click()}>
                <Upload className="h-3 w-3" /> Change
              </Button>
              <Button size="sm" variant="secondary" className="h-7 text-xs gap-1.5 backdrop-blur-md bg-background/80" onClick={() => onChange({ cover_url: null })}>
                <Trash2 className="h-3 w-3" /> Remove
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {/* Floating action row: visible on hover when no cover, always when editable */}
      {editable && (
        <div className={`flex items-center gap-2 ${coverUrl ? "" : "opacity-0 group-hover/cover:opacity-100 transition-opacity h-7"}`}>
          {!coverUrl && (
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground gap-1.5" onClick={() => fileRef.current?.click()}>
              <ImageIcon className="h-3.5 w-3.5" /> Add cover
            </Button>
          )}
          {!icon && (
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground gap-1.5">
                  <Smile className="h-3.5 w-3.5" /> Add icon
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <EmojiGrid onPick={(e) => onChange({ icon: e })} />
              </PopoverContent>
            </Popover>
          )}
        </div>
      )}

      {/* Icon row (above title) */}
      {icon && (
        <Popover>
          <PopoverTrigger asChild disabled={!editable}>
            <button
              className="text-5xl leading-none mb-2 hover:bg-muted/50 rounded-lg p-1 -ml-1 transition-colors disabled:cursor-default disabled:hover:bg-transparent"
              type="button"
            >
              {icon}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <EmojiGrid onPick={(e) => onChange({ icon: e })} onRemove={() => onChange({ icon: null })} />
          </PopoverContent>
        </Popover>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.currentTarget.value = ""; }}
      />
      {uploading && <p className="text-xs text-muted-foreground">Uploading cover…</p>}
    </div>
  );
}

function EmojiGrid({ onPick, onRemove }: { onPick: (e: string) => void; onRemove?: () => void }) {
  const [filter, setFilter] = useState("");
  const list = filter
    ? EMOJI_PRESETS.filter((e) => e.includes(filter))
    : EMOJI_PRESETS;
  return (
    <div className="space-y-2">
      <Input
        placeholder="Search…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="h-7 text-xs"
      />
      <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
        {list.map((e) => (
          <button
            key={e}
            onClick={() => onPick(e)}
            className="text-xl hover:bg-muted rounded p-1 transition-colors"
          >
            {e}
          </button>
        ))}
      </div>
      {onRemove && (
        <Button size="sm" variant="ghost" className="w-full h-7 text-xs text-muted-foreground" onClick={onRemove}>
          Remove icon
        </Button>
      )}
    </div>
  );
}
