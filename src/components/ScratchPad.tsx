import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Trash2, Paperclip, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ScratchPadProps {
  onProcess: (text: string, images: string[]) => void;
  isProcessing: boolean;
}

export function ScratchPad({ onProcess, isProcessing }: ScratchPadProps) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [padId, setPadId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load scratch pad
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("ceo_scratch_pad")
        .select("*")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (data) {
        setContent((data as any).content || "");
        setPadId((data as any).id);
      }
    })();
  }, [user]);

  const saveContent = useCallback(async (text: string) => {
    if (!user) return;
    setSaving(true);
    try {
      if (padId) {
        await supabase.from("ceo_scratch_pad").update({ content: text, updated_at: new Date().toISOString() }).eq("id", padId);
      } else {
        const { data } = await supabase.from("ceo_scratch_pad").insert({ user_id: user.id, content: text }).select().single();
        if (data) setPadId((data as any).id);
      }
    } finally {
      setSaving(false);
    }
  }, [user, padId]);

  const handleChange = (text: string) => {
    setContent(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveContent(text), 1500);
  };

  const handleClear = async () => {
    setContent("");
    setImages([]);
    await saveContent("");
    toast({ title: "Scratch pad cleared" });
  };

  const uploadImage = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Only images are supported", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Image must be under 10MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `scratch-pad/${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("files").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("files").getPublicUrl(path);
      setImages(prev => [...prev, urlData.publicUrl]);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) uploadImage(file);
        return;
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        uploadImage(file);
      }
    }
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">Scratch Pad</h2>
          {saving && <span className="text-[10px] text-muted-foreground animate-pulse">Saving...</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-muted-foreground hover:text-foreground"
            title="Attach image (paste or drop also works)"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                Array.from(e.target.files).forEach(uploadImage);
              }
              e.target.value = "";
            }}
          />
          {content.trim().length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => onProcess(content, images)}
            disabled={isProcessing || (content.trim().length < 10 && images.length === 0)}
            className="gap-1.5"
          >
            {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Process This
          </Button>
        </div>
      </div>

      {/* Image thumbnails */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url, idx) => (
            <div key={idx} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-border">
              <img src={url} alt={`Attached ${idx + 1}`} className="w-full h-full object-cover" />
              <button
                onClick={() => removeImage(idx)}
                className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3 text-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}

      <textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        placeholder="Dump everything here — tasks, ideas, broken things, reminders... Paste images of your handwritten notes too. Hit 'Process This' when ready."
        className="w-full min-h-[200px] bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 resize-y border-none outline-none leading-7"
        style={{
          backgroundImage: "repeating-linear-gradient(transparent, transparent 27px, hsl(var(--border) / 0.3) 27px, hsl(var(--border) / 0.3) 28px)",
          backgroundPositionY: "-1px",
        }}
      />
    </div>
  );
}
