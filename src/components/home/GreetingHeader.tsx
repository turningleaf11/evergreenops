import { CalendarDays } from "lucide-react";
import { format } from "date-fns";

function getGreeting(name?: string | null): string {
  const hour = new Date().getHours();
  const first = name?.split(" ")[0] || "there";
  if (hour < 5) return `Still up, ${first}?`;
  if (hour < 12) return `Good morning, ${first}`;
  if (hour < 17) return `Good afternoon, ${first}`;
  if (hour < 21) return `Good evening, ${first}`;
  return `Working late, ${first}?`;
}

export function GreetingHeader({ name }: { name?: string | null }) {
  const greeting = getGreeting(name);
  const dateStr = format(new Date(), "EEEE, MMMM d");

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-r from-accent/10 via-card to-card px-6 py-5 sm:px-8 sm:py-6 shadow-sm">
      <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
      <div className="relative">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{greeting}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" /> {dateStr}
        </p>
      </div>
    </div>
  );
}
