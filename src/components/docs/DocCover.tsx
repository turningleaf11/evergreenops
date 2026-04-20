import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ImageIcon, Smile, Trash2, Upload, Move, Check, X, Plus } from "lucide-react";
import { uploadFile } from "@/lib/file-upload";
import { Input } from "@/components/ui/input";

// Larger curated emoji set
const EMOJI_PRESETS = [
  // Documents & writing
  "📄","📃","📑","📜","📰","📓","📔","📒","📕","📗","📘","📙","📚","🗂️","🗃️","🗄️","🗒️","📝","✏️","✒️","🖊️","🖋️","🖌️","🖍️",
  // Ideas & strategy
  "💡","🚀","🎯","⭐","🌟","✨","🔥","💫","⚡","🌈","🌱","🌿","🍀","🌳","🪴",
  // Tools & building
  "🛠️","🔧","🔨","⚙️","🧰","🏗️","🧱","⛏️","🪛","🔩","🧪","🧬","🔬","🔭",
  // Navigation & maps
  "🧭","🗺️","🗿","🛰️","🛸","🪐","🌍","🌎","🌏","📍","📌","🚩","🏁",
  // Charts & data
  "📊","📈","📉","🧮","💹","📐","📏","⏱️","⏰","⌛","⏳","🕰️",
  // Communication
  "💬","🗨️","🗯️","💭","📢","📣","📯","🔔","🔕","📞","☎️","📧","📨","📩","📤","📥","📮",
  // Office
  "📎","🔖","🔍","🔎","🔑","🗝️","🛡️","🔒","🔓","🔐","🪪","💳","💰","💵","💸","🪙",
  // People & teams
  "👤","👥","🧑‍💼","👩‍💼","👨‍💼","🧑‍💻","👩‍💻","👨‍💻","🧑‍🎨","🧑‍🔬","🧑‍🏫","🧠","👀","✋","👋","🤝","👍","👏",
  // Status
  "✅","☑️","✔️","❌","❎","⚠️","🚫","🆗","🆕","🆙","🔴","🟠","🟡","🟢","🔵","🟣","⚫","⚪",
  // Buildings & places
  "🏛️","🏢","🏬","🏭","🏠","🏡","🏪","🏤","🏣","🏰","🗼",
  // Awards
  "🏆","🥇","🥈","🥉","🎖️","🏅","👑","💎",
  // Misc
  "🎨","🎭","🎬","🎤","🎧","🎮","🕹️","🧩","♟️","🎲","🃏","🀄","🎴",
];

interface Props {
  coverUrl: string | null;
  icon: string | null;
  coverPosition?: number | null;
  editable: boolean;
  onChange: (updates: { cover_url?: string | null; icon?: string | null; cover_position?: number | null }) => void;
}

export default function DocCover({ coverUrl, icon, coverPosition, editable, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [repositioning, setRepositioning] = useState(false);
  const [tempPosition, setTempPosition] = useState<number>(coverPosition ?? 50);
  const dragRef = useRef<{ startY: number; startPos: number; height: number } | null>(null);

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    const url = await uploadFile(file);
    setUploading(false);
    if (url) onChange({ cover_url: url });
  };

  const startReposition = () => {
    setTempPosition(coverPosition ?? 50);
    setRepositioning(true);
  };

  const onCoverMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!repositioning) return;
    const target = e.currentTarget;
    dragRef.current = { startY: e.clientY, startPos: tempPosition, height: target.clientHeight };
    e.preventDefault();
  };

  const onCoverMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!repositioning || !dragRef.current) return;
    const { startY, startPos, height } = dragRef.current;
    const deltaPx = e.clientY - startY;
    // Drag down => show lower part of image => decrease position; invert for natural feel
    const deltaPct = (deltaPx / height) * 100;
    const next = Math.max(0, Math.min(100, startPos - deltaPct));
    setTempPosition(next);
  };

  const onCoverMouseUp = () => { dragRef.current = null; };

  const saveReposition = () => {
    onChange({ cover_position: tempPosition });
    setRepositioning(false);
  };

  const cancelReposition = () => {
    setTempPosition(coverPosition ?? 50);
    setRepositioning(false);
  };

  const activePosition = repositioning ? tempPosition : (coverPosition ?? 50);

  return (
    <div className="group/cover">
      {coverUrl ? (
        <div className="relative -mx-6 lg:-mx-16 mb-4">
          <div
            className={`w-full h-44 md:h-56 bg-cover ${repositioning ? "cursor-move ring-2 ring-primary" : ""}`}
            style={{ backgroundImage: `url(${coverUrl})`, backgroundPosition: `center ${activePosition}%` }}
            onMouseDown={onCoverMouseDown}
            onMouseMove={onCoverMouseMove}
            onMouseUp={onCoverMouseUp}
            onMouseLeave={onCoverMouseUp}
          />
          {editable && !repositioning && (
            <div className="absolute top-3 right-4 flex gap-1.5 opacity-0 group-hover/cover:opacity-100 transition-opacity">
              <Button size="sm" variant="secondary" className="h-7 text-xs gap-1.5 backdrop-blur-md bg-background/80" onClick={startReposition}>
                <Move className="h-3 w-3" /> Reposition
              </Button>
              <Button size="sm" variant="secondary" className="h-7 text-xs gap-1.5 backdrop-blur-md bg-background/80" onClick={() => fileRef.current?.click()}>
                <Upload className="h-3 w-3" /> Change
              </Button>
              <Button size="sm" variant="secondary" className="h-7 text-xs gap-1.5 backdrop-blur-md bg-background/80" onClick={() => onChange({ cover_url: null, cover_position: 50 })}>
                <Trash2 className="h-3 w-3" /> Remove
              </Button>
            </div>
          )}
          {editable && repositioning && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md bg-background/90 border shadow-lg">
              <span className="text-xs text-muted-foreground">Drag image to reposition</span>
              <Button size="sm" className="h-6 text-xs gap-1" onClick={saveReposition}>
                <Check className="h-3 w-3" /> Save
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={cancelReposition}>
                <X className="h-3 w-3" /> Cancel
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {/* Icon (above title) */}
      {icon && (
        <Popover>
          <PopoverTrigger asChild disabled={!editable}>
            <button
              className="text-5xl leading-none mb-2 hover:bg-muted/50 rounded-lg p-1 -ml-1 transition-colors disabled:cursor-default disabled:hover:bg-transparent"
              type="button"
            >
              {icon.startsWith("http") ? (
                <img src={icon} alt="icon" className="h-12 w-12 rounded object-cover" />
              ) : (
                icon
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-2" align="start">
            <EmojiGrid onPick={(e) => onChange({ icon: e })} onRemove={() => onChange({ icon: null })} />
          </PopoverContent>
        </Popover>
      )}

      {/* Always-visible Add cover / Add icon when missing */}
      {editable && (!coverUrl || !icon) && (
        <div className="flex items-center gap-1 mb-2 -ml-1">
          {!coverUrl && (
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground gap-1.5 hover:text-foreground" onClick={() => fileRef.current?.click()}>
              <ImageIcon className="h-3.5 w-3.5" /> Add cover
            </Button>
          )}
          {!icon && (
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground gap-1.5 hover:text-foreground">
                  <Smile className="h-3.5 w-3.5" /> Add icon
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-2" align="start">
                <EmojiGrid onPick={(e) => onChange({ icon: e })} />
              </PopoverContent>
            </Popover>
          )}
        </div>
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
  const [tab, setTab] = useState<"emoji" | "custom">("emoji");
  const [uploading, setUploading] = useState(false);
  const customRef = useRef<HTMLInputElement>(null);

  const list = filter
    ? EMOJI_PRESETS.filter((e) => e.includes(filter))
    : EMOJI_PRESETS;

  const handleCustomUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    const url = await uploadFile(file);
    setUploading(false);
    if (url) onPick(url);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1 border-b pb-1">
        <button
          onClick={() => setTab("emoji")}
          className={`flex-1 text-xs py-1 rounded ${tab === "emoji" ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50"}`}
          type="button"
        >
          Emoji
        </button>
        <button
          onClick={() => setTab("custom")}
          className={`flex-1 text-xs py-1 rounded ${tab === "custom" ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50"}`}
          type="button"
        >
          Upload
        </button>
      </div>

      {tab === "emoji" ? (
        <>
          <Input
            placeholder="Search…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-7 text-xs"
          />
          <div className="grid grid-cols-9 gap-1 max-h-64 overflow-y-auto">
            {list.map((e, i) => (
              <button
                key={`${e}-${i}`}
                onClick={() => onPick(e)}
                className="text-xl hover:bg-muted rounded p-1 transition-colors"
                type="button"
              >
                {e}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => customRef.current?.click()}
            className="w-full border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center gap-1 hover:bg-muted/40 transition-colors"
          >
            <Plus className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Upload custom icon</span>
            <span className="text-[10px] text-muted-foreground/70">PNG, JPG, SVG</span>
          </button>
          <input
            ref={customRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCustomUpload(f); e.currentTarget.value = ""; }}
          />
          {uploading && <p className="text-xs text-muted-foreground text-center">Uploading…</p>}
        </div>
      )}

      {onRemove && (
        <Button size="sm" variant="ghost" className="w-full h-7 text-xs text-muted-foreground" onClick={onRemove}>
          Remove icon
        </Button>
      )}
    </div>
  );
}
