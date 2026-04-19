import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Trash2, ImagePlus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import RichTextEditor from "@/components/RichTextEditor";
import { cn } from "@/lib/utils";
import { uploadFile, triggerFileInput } from "@/lib/file-upload";

interface ScratchPadProps {
  onProcess: (text: string, images: string[]) => void;
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Track focus/blur within the editor surface
  useEffect(() => {
    const root = wrapperRef.current;
    if (!root) return;
    const onFocusIn = () => setFocused(true);
    const onFocusOut = (e: FocusEvent) => {
      // Only blur if focus has left the wrapper entirely
      if (!root.contains(e.relatedTarget as Node)) setFocused(false);
    };
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    return () => {
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
    };
  }, [loaded]);

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
      setLoaded(true);
    })();
  }, [user]);

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

  const handleChange = (html: string) => {
    setContent(html);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveContent(html), 1500);
  };

  const handleClear = async () => {
    setContent("");
    await saveContent("");
    toast({ title: "Scratch pad cleared" });
  };

  const handleProcess = () => {
    const { text, images } = extractTextAndImages(content);
    onProcess(text, images);
  };

  const { text: plainText } = extractTextAndImages(content);
  const isEmpty = plainText.trim().length < 10;
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
          {saving && <span className="text-[10px] text-muted-foreground animate-pulse">Saving...</span>}
        </div>
        <div className="flex items-center gap-2">
          {!isEmpty && (
            <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="default"
            onClick={handleProcess}
            disabled={isProcessing || isEmpty}
            className={cn(
              "h-8 w-8 transition-shadow",
              state === "focus" && !isEmpty && "shadow-[0_0_16px_hsl(var(--primary)/0.45)]",
            )}
            title="Process This"
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
              placeholder="Dump everything here — tasks, ideas, broken things, reminders... Type '/' for commands. Hit 'Process This' when ready."
              borderless
            />
          </div>
        </div>
      )}
    </div>
  );
}
