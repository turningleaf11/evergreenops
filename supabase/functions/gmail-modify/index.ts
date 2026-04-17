import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';
import { getGmailContext, gmail } from '../_shared/gmail.ts';

const ACTIONS: Record<string, { add?: string[]; remove?: string[] }> = {
  read: { remove: ['UNREAD'] },
  unread: { add: ['UNREAD'] },
  archive: { remove: ['INBOX'] },
  unarchive: { add: ['INBOX'] },
  star: { add: ['STARRED'] },
  unstar: { remove: ['STARRED'] },
  trash: { add: ['TRASH'], remove: ['INBOX'] },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const { ctx, error } = await getGmailContext(req);
  if (error) return json(error.body, error.status);

  const { threadId, action } = await req.json();
  if (!threadId || !action) return json({ error: 'threadId and action required' }, 400);
  const op = ACTIONS[action];
  if (!op) return json({ error: 'Unknown action' }, 400);

  const r = await gmail(ctx!, `/threads/${threadId}/modify`, {
    method: 'POST',
    body: JSON.stringify({ addLabelIds: op.add ?? [], removeLabelIds: op.remove ?? [] }),
  });
  if (!r.ok) return json({ error: await r.text() }, r.status);
  return json({ ok: true });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
