import { useState } from "react";
import { Quote as QuoteIcon, RefreshCw } from "lucide-react";
import { getDailyQuote, getRandomQuote, type Quote } from "@/lib/motivational-quotes";

export function DailyMotivation() {
  const [quote, setQuote] = useState<Quote>(() => getDailyQuote());

  const reroll = () => {
    setQuote((prev) => getRandomQuote(prev));
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-accent/5 to-card p-5 shadow-sm h-full flex flex-col">
      <div className="absolute -top-6 -right-6 h-32 w-32 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <QuoteIcon className="h-4 w-4" />
          </div>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
            Daily motivation
          </span>
        </div>
        <button
          onClick={reroll}
          className="h-7 w-7 rounded-md hover:bg-background/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          title="New quote"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="relative mt-3 flex-1 flex flex-col justify-center">
        <p className="text-[15px] leading-snug font-medium text-foreground">
          "{quote.quote}"
        </p>
        <p className="mt-2 text-xs text-muted-foreground">— {quote.author}</p>
      </div>
    </div>
  );
}
