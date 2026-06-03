// CoverImageZone — renders a hero image at the top of an entity peek.
//
// Only renders when there IS an image. When empty, renders nothing —
// adding a cover is a deliberate action triggered from the entity's
// (⋯) menu via the <CoverMenuItems> helper below, not a passive
// space-consuming dropzone.
//
// Filled state: full-bleed image with a quiet hover overlay offering
// Change / Remove.

import { useRef, useState } from "react";
import { Loader2, RotateCcw, X, ImagePlus } from "lucide-react";
import { uploadFile } from "@/lib/file-upload";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

interface CoverImageZoneProps {
  url: string | null | undefined;
  onChange: (url: string | null) => void | Promise<void>;
  editable?: boolean;
  aspect?: string;
  className?: string;
}

export function CoverImageZone({
  url, onChange, editable = true, aspect = "16/9", className,
}: CoverImageZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (!url) return null; // No empty state — opt-in via the (⋯) menu.

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image (jpg, png, webp, etc.)");
      return;
    }
    setUploading(true);
    try {
      const publicUrl = await uploadFile(file);
      if (!publicUrl) throw new Error("Upload failed");
      await onChange(publicUrl);
      toast.success("Cover updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't upload cover");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl bg-muted group",
        className,
      )}
      style={{ aspectRatio: aspect }}
    >
      <img src={url} alt="" className="w-full h-full object-cover" />
      {editable && (
        <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/95 text-foreground text-xs font-medium shadow-md hover:bg-white"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            {uploading ? "Uploading..." : "Change"}
          </button>
          <button
            onClick={() => onChange(null)}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/95 text-foreground text-xs font-medium shadow-md hover:bg-white"
          >
            <X className="h-3.5 w-3.5" /> Remove
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

// ── CoverMenuItems — drop-in dropdown items for any peek's (⋯) menu ─────────
//
// Usage inside a <DropdownMenuContent>:
//
//   <CoverMenuItems url={deal.cover_url} onChange={(url) => save({ cover_url: url })} />
//
// Renders "Add cover image" when empty, "Change cover" + "Remove cover" when set.
// Encapsulates the hidden file input + upload flow.

interface CoverMenuItemsProps {
  url: string | null | undefined;
  onChange: (url: string | null) => void | Promise<void>;
}

export function CoverMenuItems({ url, onChange }: CoverMenuItemsProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image");
      return;
    }
    try {
      const publicUrl = await uploadFile(file);
      if (!publicUrl) throw new Error("Upload failed");
      await onChange(publicUrl);
      toast.success(url ? "Cover updated" : "Cover added");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't upload cover");
    }
  };

  return (
    <>
      <DropdownMenuItem
        onSelect={(e) => { e.preventDefault(); inputRef.current?.click(); }}
      >
        {url ? (
          <>
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Change cover image</span>
          </>
        ) : (
          <>
            <ImagePlus className="h-3.5 w-3.5" />
            <span>Add cover image</span>
          </>
        )}
      </DropdownMenuItem>
      {url && (
        <DropdownMenuItem onSelect={() => onChange(null)}>
          <X className="h-3.5 w-3.5" />
          <span>Remove cover</span>
        </DropdownMenuItem>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </>
  );
}
