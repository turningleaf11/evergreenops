import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heart, ArrowRight, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

export function RecognitionWidget() {
  const [items, setItems] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [kudosRes, profRes] = await Promise.all([
        supabase
          .from("kudos")
          .select("id, from_user_id, to_user_id, message, category, created_at")
          .gte("created_at", sevenDaysAgo)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("profiles").select("user_id, full_name"),
      ]);
      if (kudosRes.data) setItems(kudosRes.data);
      if (profRes.data) {
        const map: Record<string, string> = {};
        profRes.data.forEach((p: any) => { map[p.user_id] = p.full_name || "Teammate"; });
        setProfiles(map);
      }
    };
    load();
  }, []);

  const initials = (name: string) => name.split(" ").map((n) => n[0]).slice(0, 2).join("");

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-500" /> Recognition
          </h2>
          <Link to="/feed" className="text-xs text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="py-3 text-center">
            <Heart className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">No kudos this week — be the first to give some 💛</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((k) => {
              const fromName = profiles[k.from_user_id] || "Someone";
              const toName = profiles[k.to_user_id] || "a teammate";
              return (
                <div key={k.id} className="flex items-start gap-2.5">
                  <div className="relative shrink-0">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px] bg-muted">{initials(fromName)}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-rose-500 flex items-center justify-center">
                      <Heart className="h-2 w-2 text-white fill-white" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-snug">
                      <span className="font-semibold">{fromName}</span>
                      <span className="text-muted-foreground"> recognized </span>
                      <span className="font-semibold">{toName}</span>
                    </p>
                    {k.message && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 italic">"{k.message}"</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {formatDistanceToNow(new Date(k.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
