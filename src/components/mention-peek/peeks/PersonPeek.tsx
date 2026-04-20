import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Briefcase, Building2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props { id: string; open: boolean; onClose: () => void; }

export default function PersonPeek({ id, open, onClose }: Props) {
  const navigate = useNavigate();
  const [p, setP] = useState<any>(null);
  const [dept, setDept] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", id).maybeSingle();
      if (cancelled) return;
      setP(data);
      if (data?.department_id) {
        const { data: d } = await supabase.from("departments").select("name").eq("id", data.department_id).maybeSingle();
        if (!cancelled) setDept(d?.name ?? null);
      } else setDept(null);
    })();
    return () => { cancelled = true; };
  }, [id, open]);

  const initials = (p?.full_name || "U").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-8 pb-6">
          <Avatar className="h-20 w-20 mb-4 ring-2 ring-background shadow-lg">
            {p?.avatar_url && <AvatarImage src={p.avatar_url} />}
            <AvatarFallback className="bg-primary/20 text-primary text-lg font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <SheetHeader className="space-y-1 text-left">
            <SheetTitle className="text-2xl">{p?.full_name || "Loading..."}</SheetTitle>
            {p?.title && <p className="text-sm text-muted-foreground">{p.title}</p>}
          </SheetHeader>
          {p?.availability_status && (
            <Badge variant="secondary" className="mt-3 capitalize">{p.availability_status}</Badge>
          )}
        </div>

        <div className="px-6 py-5 space-y-3">
          {dept && (
            <div className="flex items-center gap-3 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{dept}</span>
            </div>
          )}
          {p?.email && (
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <a href={`mailto:${p.email}`} className="hover:underline truncate">{p.email}</a>
            </div>
          )}
          {p?.phone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <a href={`tel:${p.phone}`} className="hover:underline">{p.phone}</a>
            </div>
          )}
          {p?.bio && (
            <div className="pt-3 border-t border-border/40">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">About</p>
              <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{p.bio}</p>
            </div>
          )}
          {p?.skills && p.skills.length > 0 && (
            <div className="pt-3 border-t border-border/40">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5" /> Skills
              </p>
              <div className="flex flex-wrap gap-1.5">
                {p.skills.map((s: string) => (
                  <Badge key={s} variant="secondary" className="text-[11px] rounded-full">{s}</Badge>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => { onClose(); navigate(`/people?u=${id}`); }}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open full profile
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
