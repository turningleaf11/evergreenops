// Global handler for @mention chips inserted by the TipTap MentionExtension.
// Routes clicks to the MentionPeekProvider which renders contextual peeks
// (slideouts/modals) instead of navigating away from the current page.
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMentionPeek, PeekType } from "@/components/mention-peek/MentionPeekProvider";

const PEEK_TYPES: PeekType[] = ["person", "doc", "note", "task", "project", "goal", "record"];

export function MentionClickHandler() {
  const navigate = useNavigate();
  const { openPeek } = useMentionPeek();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Skip if the click was on a mention-remove button (its own handler removes the chip)
      const removeBtn = (e.target as HTMLElement)?.closest?.("[data-mention-remove]");
      if (removeBtn) return;

      const target = (e.target as HTMLElement)?.closest?.("[data-type='mention'], .mention-chip") as HTMLElement | null;
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();
      const type = target.getAttribute("data-mention-type") as PeekType | null;
      const id = target.getAttribute("data-mention-id");
      const url = target.getAttribute("data-url") || target.getAttribute("href");

      if (type && id && PEEK_TYPES.includes(type)) {
        openPeek(type, id);
        return;
      }
      // Fallbacks for unknown types or external URLs
      if (!url || url === "#") return;
      if (url.startsWith("http")) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      navigate(url);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [navigate, openPeek]);

  return null;
}
