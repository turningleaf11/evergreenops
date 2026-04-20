import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Backlink {
  id: string;
  title: string;
  source: "doc" | "note";
}

/**
 * Finds all docs/notes whose HTML content references this entity id
 * via a TipTap mention chip (data-mention-id="<id>").
 */
export function useBacklinks(entityId: string | null | undefined) {
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!entityId) { setBacklinks([]); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const needle = `data-mention-id="${entityId}"`;
      const [docsRes, notesRes] = await Promise.all([
        supabase.from("documents").select("id, title").ilike("content", `%${needle}%`).neq("id", entityId).limit(50),
        supabase.from("notes").select("id, title").ilike("content", `%${needle}%`).neq("id", entityId).limit(50),
      ]);
      if (cancelled) return;
      const links: Backlink[] = [
        ...((docsRes.data || []).map((d: any) => ({ id: d.id, title: d.title || "Untitled", source: "doc" as const }))),
        ...((notesRes.data || []).map((n: any) => ({ id: n.id, title: n.title || "Untitled", source: "note" as const }))),
      ];
      setBacklinks(links);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [entityId]);

  return { backlinks, loading };
}
