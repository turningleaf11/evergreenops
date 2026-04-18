// Lists Gmail labels for the connected workspace account so the team
// inbox can show the user's actual Gmail labels (Important, Promotions,
// custom labels, etc.) — not just locally-created ones.
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { getGmailContext, gmail } from "../_shared/gmail.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { ctx, error } = await getGmailContext(req);
  if (error) return json(error.body, error.status);

  const r = await gmail(ctx!, "/labels");
  if (!r.ok) return json({ error: await r.text() }, r.status);
  const data: { labels?: { id: string; name: string; type: string; labelListVisibility?: string }[] } = await r.json();

  // Filter out "system" labels we already render as folders (INBOX, SENT, etc.),
  // and labels the user hides from the list.
  const HIDDEN = new Set(["INBOX", "SENT", "DRAFT", "TRASH", "SPAM", "STARRED", "UNREAD", "CHAT"]);
  const labels = (data.labels ?? [])
    .filter((l) => !HIDDEN.has(l.id))
    .filter((l) => l.labelListVisibility !== "labelHide")
    .map((l) => ({ id: l.id, name: l.name, type: l.type }));

  return json({ labels });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
