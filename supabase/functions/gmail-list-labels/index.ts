// Lists Gmail labels (with hierarchy + colors) so the inbox sidebar can render
// the user's actual Gmail label tree (Team Emails/MTorres, Triggers/PushLead, etc.).
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { getGmailContext, gmail } from "../_shared/gmail.ts";

interface GmailLabel {
  id: string;
  name: string;
  type: string;
  labelListVisibility?: string;
  color?: { backgroundColor?: string; textColor?: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { ctx, error } = await getGmailContext(req);
  if (error) return json(error.body, error.status);

  const r = await gmail(ctx!, "/labels");
  if (!r.ok) return json({ error: await r.text() }, r.status);
  const data: { labels?: GmailLabel[] } = await r.json();

  // Hide built-in folders we already surface elsewhere, and Gmail's noisy
  // auto-classifier "system" labels (CATEGORY_*, *_STAR/*_BUBBLE color-star
  // variants, IMPORTANT, etc.) — users don't manage those, they pollute the
  // sidebar.
  const HIDDEN = new Set([
    "INBOX", "SENT", "DRAFT", "TRASH", "SPAM", "STARRED", "UNREAD", "CHAT", "IMPORTANT",
  ]);
  const isNoisySystem = (l: GmailLabel) => {
    if (l.type !== "system") return false;
    if (l.id.startsWith("CATEGORY_")) return true;
    // Color-star / color-bubble variants Gmail exposes alongside STARRED
    if (/_STAR$|_BUBBLE$|_GUILLEMET$|_CHECK$|^STAR_/.test(l.id)) return true;
    return false;
  };

  const labels = (data.labels ?? [])
    .filter((l) => !HIDDEN.has(l.id))
    .filter((l) => !isNoisySystem(l))
    .filter((l) => l.labelListVisibility !== "labelHide")
    .map((l) => {
      const path = l.name.split("/");
      return {
        id: l.id,
        name: l.name,
        leaf: path[path.length - 1],
        path,
        depth: path.length - 1,
        type: l.type,
        color: l.color?.backgroundColor ?? null,
      };
    })
    // Parents first, alphabetical within siblings
    .sort((a, b) => a.name.localeCompare(b.name));

  return json({ labels });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
