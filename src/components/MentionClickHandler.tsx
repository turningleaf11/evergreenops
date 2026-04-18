// Global handler for @mention chips inserted by the TipTap MentionExtension.
// - Uses React Router navigation instead of full page loads (which were
//   sending the user to an external Lovable host).
// - For person mentions, shows a hover card preview with directory info.
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mail, Phone, Briefcase } from "lucide-react";

interface PersonInfo {
  user_id: string;
  full_name: string | null;
  email: string | null;
  title: string | null;
  phone: string | null;
  avatar_url: string | null;
}

export function MentionClickHandler() {
  const navigate = useNavigate();
  const [hover, setHover] = useState<{ x: number; y: number; person: PersonInfo } | null>(null);
  const [hoverTimer, setHoverTimer] = useState<number | null>(null);

  const fetchPerson = useCallback(async (id: string): Promise<PersonInfo | null> => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, title, phone, avatar_url")
      .eq("user_id", id)
      .maybeSingle();
    return (data as PersonInfo) || null;
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.("[data-type='mention'], .mention-chip") as HTMLElement | null;
      if (!target) return;
      const url = target.getAttribute("data-url") || target.getAttribute("href");
      e.preventDefault();
      e.stopPropagation();
      if (!url || url === "#") return;
      if (url.startsWith("http")) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      navigate(url);
    };

    const onMouseOver = async (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.("[data-type='mention'], .mention-chip") as HTMLElement | null;
      if (!target) return;
      const type = target.getAttribute("data-mention-type");
      const id = target.getAttribute("data-mention-id");
      if (type !== "person" || !id) return;
      if (hoverTimer) window.clearTimeout(hoverTimer);
      const timer = window.setTimeout(async () => {
        const person = await fetchPerson(id);
        if (!person) return;
        const rect = target.getBoundingClientRect();
        setHover({ x: rect.left, y: rect.bottom + 6, person });
      }, 200);
      setHoverTimer(timer as unknown as number);
    };

    const onMouseOut = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.("[data-type='mention'], .mention-chip");
      if (!target) return;
      if (hoverTimer) window.clearTimeout(hoverTimer);
      window.setTimeout(() => setHover(null), 150);
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("mouseover", onMouseOver);
    document.addEventListener("mouseout", onMouseOut);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("mouseover", onMouseOver);
      document.removeEventListener("mouseout", onMouseOut);
    };
  }, [navigate, fetchPerson, hoverTimer]);

  if (!hover) return null;

  const initials = (hover.person.full_name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return createPortal(
    <div
      className="fixed z-[100] w-72 rounded-lg border bg-popover shadow-xl p-3 text-sm pointer-events-none animate-in fade-in zoom-in-95"
      style={{ left: Math.min(hover.x, window.innerWidth - 300), top: hover.y }}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12">
          {hover.person.avatar_url && <AvatarImage src={hover.person.avatar_url} />}
          <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{hover.person.full_name || "Unknown"}</div>
          {hover.person.title && (
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Briefcase className="h-3 w-3" /> {hover.person.title}
            </div>
          )}
          {hover.person.email && (
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
              <Mail className="h-3 w-3 shrink-0" /> {hover.person.email}
            </div>
          )}
          {hover.person.phone && (
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Phone className="h-3 w-3" /> {hover.person.phone}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
