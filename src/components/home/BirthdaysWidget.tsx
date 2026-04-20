import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Cake, PartyPopper } from "lucide-react";
import { format, differenceInCalendarDays, parseISO } from "date-fns";

interface Item {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  type: "birthday" | "anniversary";
  date: Date;
  daysAway: number;
  years?: number;
}

function nextOccurrence(monthDay: Date, today: Date): Date {
  const next = new Date(today.getFullYear(), monthDay.getMonth(), monthDay.getDate());
  if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    next.setFullYear(today.getFullYear() + 1);
  }
  return next;
}

export function BirthdaysWidget() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url, birthday, start_date")
      .or("birthday.not.is.null,start_date.not.is.null")
      .then(({ data }) => {
        if (!data) return;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const list: Item[] = [];

        data.forEach((p: any) => {
          if (p.birthday) {
            const bday = parseISO(p.birthday);
            const next = nextOccurrence(bday, today);
            const days = differenceInCalendarDays(next, today);
            if (days <= 30) {
              list.push({
                user_id: p.user_id,
                full_name: p.full_name,
                avatar_url: p.avatar_url,
                type: "birthday",
                date: next,
                daysAway: days,
              });
            }
          }
          if (p.start_date) {
            const start = parseISO(p.start_date);
            const next = nextOccurrence(start, today);
            const days = differenceInCalendarDays(next, today);
            const years = next.getFullYear() - start.getFullYear();
            if (days <= 30 && years >= 1) {
              list.push({
                user_id: p.user_id + "-anniv",
                full_name: p.full_name,
                avatar_url: p.avatar_url,
                type: "anniversary",
                date: next,
                daysAway: days,
                years,
              });
            }
          }
        });

        list.sort((a, b) => a.daysAway - b.daysAway);
        setItems(list.slice(0, 5));
      });
  }, []);

  const labelFor = (it: Item) => {
    if (it.daysAway === 0) return "Today 🎉";
    if (it.daysAway === 1) return "Tomorrow";
    if (it.daysAway <= 7) return `In ${it.daysAway} days`;
    return format(it.date, "MMM d");
  };

  return (
    <Card className="h-full">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Cake className="h-4 w-4 text-pink-500" /> Celebrations
          </h2>
        </div>

        {items.length === 0 ? (
          <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
            <PartyPopper className="h-3.5 w-3.5 text-muted-foreground/40" />
            <span>No upcoming celebrations</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {items.map((it) => {
              const initials = (it.full_name || "U").split(" ").map((n) => n[0]).slice(0, 2).join("");
              const Icon = it.type === "birthday" ? Cake : PartyPopper;
              const tone = it.type === "birthday" ? "text-pink-500" : "text-amber-500";
              return (
                <div key={it.user_id} className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-muted/40 transition-colors">
                  <Avatar className="h-8 w-8 shrink-0">
                    {it.avatar_url && <AvatarImage src={it.avatar_url} />}
                    <AvatarFallback className="text-[10px] bg-muted">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate leading-tight flex items-center gap-1.5">
                      <Icon className={`h-3.5 w-3.5 ${tone}`} />
                      {it.full_name || "Teammate"}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {it.type === "birthday" ? "Birthday" : `${it.years}-year work anniversary`}
                    </p>
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground shrink-0">{labelFor(it)}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
