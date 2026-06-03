// CoverImageZone — drop / click to add a hero image to any entity.
//
// Two states:
//   - Empty: dashed dropzone, ~aspect-[16/9], "Drop image or click to upload"
//   - Filled: shows the image full-bleed with a quiet "Change" + "Remove"
//             overlay that appears on hover
//
// The save callback receives a URL (string) or null (to clear).
// Upload goes through the existing files bucket via uploadFile().

import { useRef, useState } from "react";
import { Loader2, ImagePlus, RotateCcw, X } from "lucide-react";
import { uploadFile } from "@/lib/file-upload";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  /** Current cover URL — null to show empty state. */
  url: string | null | undefined;
  /** Save callback; called with a public URL or null. */
  onChange: (url: string | null) => void | Promise<void>;
  /** Hide while non-admins view. Default: true (anyone can edit). */
  editable?: boolean;
  /** Override aspect ratio. Default: 16/9. */
  aspect?: string;
  className?: string;
}

export function CoverImageZone({
  url, onChange, editable = true, aspect = "16/9", className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Please drop an image file (jpg, png, webp, etc.)");
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

  const handleClick = () => {
    if (!editable || uploading) return;
    inputRef.current?.click();
  };

  // Filled state
  if (url) {
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
              onClick={handleClick}
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

  // Empty state
  if (!editable) return null;
  return (
    <button
      onClick={handleClick}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void handleFiles(e.dataTransfer.files);
      }}
      disabled={uploading}
      className={cn(
        "w-full rounded-xl border border-dashed transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs",
        dragOver ? "border-primary bg-primary/5 text-primary" : "border-border/60 bg-muted/20 hover:bg-muted/40 hover:border-border",
        uploading && "opacity-60 cursor-not-allowed",
        className,
      )}
      style={{ aspectRatio: aspect }}
    >
      {uploading ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Uploading...</span>
        </>
      ) : (
        <>
          <ImagePlus className="h-5 w-5" />
          <span className="font-medium">Drop a cover image</span>
          <span className="text-[10px] text-muted-foreground/70">or click to upload</span>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </button>
  );
}
