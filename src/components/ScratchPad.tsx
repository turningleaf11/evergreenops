import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ScratchPadProps {
  onProcess: (text: string) => void;
  isProcessing: boolean;
}

export function ScratchPad({ onProcess, isProcessing }: ScratchPadProps) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [padId, setPadId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    await saveContent("");
    toast({ title: "Scratch pad cleared" });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">Scratch Pad</h2>
          {saving && <span className="text-[10px] text-muted-foreground animate-pulse">Saving...</span>}
        </div>
        <div className="flex items-center gap-2">
          {content.trim().length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => onProcess(content)}
            disabled={isProcessing || content.trim().length < 10}
            className="gap-1.5"
          >
            {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Process This
          </Button>
        </div>
      </div>
      <textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Dump everything here — tasks, ideas, broken things, reminders, next projects... Hit 'Process This' when you're ready to organize."
        className="w-full min-h-[200px] bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 resize-y border-none outline-none leading-7"
        style={{
          backgroundImage: "repeating-linear-gradient(transparent, transparent 27px, hsl(var(--border) / 0.3) 27px, hsl(var(--border) / 0.3) 28px)",
          backgroundPositionY: "-1px",
        }}
      />
    </div>
  );
}
