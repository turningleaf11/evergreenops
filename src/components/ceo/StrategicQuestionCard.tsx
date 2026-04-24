import { useEffect, useState, useContext, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CompanionContext } from "@/contexts/CompanionContext";
import { Sparkles, ArrowRight, RefreshCw, Loader2 } from "lucide-react";

export function StrategicQuestionCard() {
  const [question, setQuestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [failed, setFailed] = useState(false);
  const companion = useContext(CompanionContext);

  const load = useCallback(async (force = false) => {
    try {
      if (force) setRegenerating(true);
      else setLoading(true);
      const { data, error } = await supabase.functions.invoke("ceo-strategic-question", {
        body: { force },
      });
      if (error || !data?.question) {
        setFailed(true);
        setQuestion(null);
      } else {
        setQuestion(data.question);
        setFailed(false);
      }
    } catch {
      setFailed(true);
      setQuestion(null);
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const handleThinkThrough = () => {
    if (!question || !companion) return;
    companion.setInput(question);
    companion.setOpen(true);
  };

  // Fail silently
  if (failed && !loading) return null;
  if (loading) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card/60 p-5 elevation-1 flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading this week's strategic question…
      </div>
    );
  }
  if (!question) return null;

  return (
    <div className="relative rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.04] via-card to-card p-6 elevation-2 overflow-hidden">
      {/* AI badge */}
      <div className="absolute top-4 right-4 flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
        <Sparkles className="h-2.5 w-2.5" />
        AI
      </div>

      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-3">
        This Week's Strategic Question
      </p>

      <p className="text-lg font-medium leading-relaxed text-foreground tracking-tight pr-12 italic">
        “{question}”
      </p>

      <div className="mt-5 flex items-center justify-between gap-4">
        <button
          onClick={handleThinkThrough}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors elevation-1 hover:elevation-2"
        >
          Think through this
          <ArrowRight className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => load(true)}
          disabled={regenerating}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Not relevant
        </button>
      </div>
    </div>
  );
}
