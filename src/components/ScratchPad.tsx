import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, ImagePlus, Plus, History, MessageCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import RichTextEditor from "@/components/RichTextEditor";
import { cn } from "@/lib/utils";
import { uploadFile, triggerFileInput } from "@/lib/file-upload";
import { ScratchPadHistorySheet } from "@/components/ScratchPadHistorySheet";
import { ScratchPadDiscussSheet } from "@/components/ScratchPadDiscussSheet";
import { AlbusAvatar } from "@/components/AlbusAvatar";

interface ScratchPadProps {
  onProcess: (text: string, images: string[]) => Promise<void> | void;
  isProcessing: boolean;
}

function extractTextAndImages(html: string): { text: string; images: string[] } {
  const div = document.createElement("div");
  div.innerHTML = html;
  const images: string[] = [];
  div.querySelectorAll("img").forEach((img) => {
    if (img.src) images.push(img.src);
  });
  const text = div.textContent || "";
  return { text, images };
}

export function ScratchPad({ onProcess, isProcessing }: ScratchPadProps) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [padId, setPadId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [discussOpen, setDiscussOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const saveContent = useCallback(async (html: string) => {
    if (!user) return;
    setSaving(true);
    try {
      if (padId) {
        await supabase.from("ceo_scratch_pad").update({ content: html, updated_at: new Date().toISOString() }).eq("id", padId);
      } else {
        const { data } = await supabase.from("ceo_scratch_pad").insert({ user_id: user.id, content: html }).select().single();
        if (data) setPadId((data as any).id);
      }
    } finally {
      setSaving(false);
    }
  }, [user, padId]);

  const handleImageUpload = useCallback(() => {
    triggerFileInput("image/*", async (file) => {
      setUploadingImage(true);
      try {
        const url = await uploadFile(file);
        if (!url) {
          toast({ title: "Upload failed", description: "Could not upload image", variant: "destructive" });
          return;
        }
        const newHtml = (content || "") + `<p><img src="${url}" alt="${file.name}" /></p>`;
        setContent(newHtml);
        await saveContent(newHtml);
      } catch (e: any) {
        toast({ title: "Upload failed", description: e.message, variant: "destructive" });
      } finally {
        setUploadingImage(false);
      }
    });
  }, [content, saveContent]);

  useEffect(() => {
    const root = wrapperRef.current;
    if (!root) return;
    const onFocusIn = () => setFocused(true);
    const onFocusOut = (e: FocusEvent) => {
      if (!root.contains(e.relatedTarget as Node)) setFocused(false);
    };
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    return () => {
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
    };
  }, [loaded]);

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
      setLoaded(true);
    })();
  }, [user]);

  const handleChange = (html: string) => {
    setContent(html);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveContent(html), 1500);
  };

  const handleNew = async () => {
    if (!isEmpty) {
      const ok = window.confirm("Start a fresh page? Your current notes will be archived to History.");
      if (!ok) return;
      // Archive before clearing
      if (user) {
        await supabase.from("ceo_scratch_pad_archive").insert({
          user_id: user.id,
          content,
          triaged_count: 0,
        });
      }
    }
    setContent("");
    await saveContent("");
    toast({ title: "Fresh page" });
  };

  const handleProcess = async () => {
    const { text, images } = extractTextAndImages(content);
    await onProcess(text, images);
    // Edge function clears the pad row server-side; mirror it locally
    setContent("");
  };

  const { text: plainText, images: plainImages } = extractTextAndImages(content);
  const isEmpty = plainText.trim().length < 3 && plainImages.length === 0;
  const state: "idle" | "hover" | "focus" = focused ? "focus" : (hovered ? "hover" : "idle");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles
            className={cn(
              "h-3.5 w-3.5 text-primary transition-opacity",
              state === "focus" ? "opacity-100 animate-pulse-soft" : "opacity-60",
            )}
          />
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Scratch Pad</h2>
          {(saving || uploadingImage) && (
            <span className="text-[10px] text-muted-foreground animate-pulse">
              {uploadingImage ? "Uploading image..." : "Saving..."}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setHistoryOpen(true)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="History"
          >
            <History className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNew}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="New page"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleImageUpload}
            disabled={uploadingImage}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Add image"
          >
            {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDiscussOpen(true)}
            disabled={isEmpty || isProcessing}
            className="h-8 gap-1.5 ml-1"
            title="Talk it through with Albus before filing"
          >
            <AlbusAvatar size="sm" />
            <span className="hidden sm:inline text-xs">Discuss</span>
          </Button>
          <Button
            size="icon"
            variant="default"
            onClick={handleProcess}
            disabled={isProcessing || isEmpty}
            className={cn(
              "h-8 w-8 transition-shadow",
              state === "focus" && !isEmpty && "shadow-[0_0_16px_hsl(var(--primary)/0.45)]",
            )}
            title="Process & file this page"
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {loaded && (
        <div
          ref={wrapperRef}
          data-state={state}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="scratchpad-magic group relative rounded-xl"
        >
          <div className="scratchpad-inner relative rounded-[10px] bg-card p-4 min-h-[200px]">
            <RichTextEditor
              content={content}
              onChange={handleChange}
              placeholder="Fresh page. Dump anything — tasks, ideas, broken things. Paste or drop a photo (handwritten notes, whiteboards) and AI will read it. Type '/' for commands."
              borderless
            />
          </div>
        </div>
      )}

      <ScratchPadHistorySheet open={historyOpen} onOpenChange={setHistoryOpen} />
      <ScratchPadDiscussSheet
        open={discussOpen}
        onOpenChange={setDiscussOpen}
        scratchpadText={plainText}
        scratchpadImages={plainImages}
        onTriageNow={handleProcess}
      />
    </div>
  );
}
