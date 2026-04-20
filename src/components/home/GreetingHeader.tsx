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
    <div className="px-1 py-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground/80 font-medium">{dateStr}</p>
      <h1 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight">{greeting}</h1>
    </div>
  );
}
