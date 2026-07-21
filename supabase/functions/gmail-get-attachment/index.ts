// gmail-get-attachment
// ---------------------
// Returns a single Gmail attachment as a base64 data URI so the inbox can show
// images inline and offer file downloads. Kept small: the client passes the
// message id + attachment id (from gmail-get-thread) and the desired mime type.
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';
import { getGmailContext, gmail } from '../_shared/gmail.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const messageId = url.searchParams.get('message_id');
  const attachmentId = url.searchParams.get('attachment_id');
  const mime = url.searchParams.get('mime') ?? 'application/octet-stream';
  if (!messageId || !attachmentId) {
    return json({ error: 'message_id and attachment_id are required' }, 400);
  }

  const { ctx, error } = await getGmailContext(req);
  if (error) return json(error.body, error.status);

  const r = await gmail(ctx!, `/messages/${messageId}/attachments/${attachmentId}`);
  if (!r.ok) return json({ error: await r.text() }, r.status);
  const data: any = await r.json();

  // Gmail returns URL-safe base64; convert to standard base64 for a data URI.
  const b64 = String(data.data ?? '').replace(/-/g, '+').replace(/_/g, '/');
  return json({ data_uri: `data:${mime};base64,${b64}`, size: data.size ?? null });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
