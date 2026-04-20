import { useState } from "react";
import { Quote as QuoteIcon, RefreshCw } from "lucide-react";
import { getDailyQuote, getRandomQuote, type Quote } from "@/lib/motivational-quotes";

export function DailyMotivation() {
  const [quote, setQuote] = useState<Quote>(() => getDailyQuote());

  const reroll = () => {
    setQuote((prev) => getRandomQuote(prev));
  };

  return (
    <div className="group relative flex items-start gap-3 px-1 py-2 h-full">
      <QuoteIcon className="h-5 w-5 text-primary/60 shrink-0 mt-1" strokeWidth={2.25} />
      <div className="flex-1 min-w-0">
        <p
          className="text-[17px] sm:text-[18px] leading-snug text-foreground/90 italic"
          style={{ fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif", fontWeight: 500 }}
        >
          {quote.quote}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground tracking-wide">— {quote.author}</p>
      </div>
      <button
        onClick={reroll}
        className="opacity-0 group-hover:opacity-100 h-6 w-6 rounded-md hover:bg-muted/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all shrink-0"
        title="New quote"
      >
        <RefreshCw className="h-3 w-3" />
      </button>
    </div>
  );
}
