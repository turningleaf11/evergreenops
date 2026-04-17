import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';
import { getGmailContext, gmail } from '../_shared/gmail.ts';

interface SendBody {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const { ctx, error } = await getGmailContext(req);
  if (error) return json(error.body, error.status);

  const body: SendBody = await req.json();
  if (!body.to || !body.subject) return json({ error: 'to and subject required' }, 400);

  const headers: string[] = [
    `From: ${ctx!.email}`,
    `To: ${body.to}`,
    body.cc ? `Cc: ${body.cc}` : '',
    body.bcc ? `Bcc: ${body.bcc}` : '',
    `Subject: ${body.subject}`,
    body.inReplyTo ? `In-Reply-To: ${body.inReplyTo}` : '',
    body.references ? `References: ${body.references}` : '',
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
  ].filter(Boolean);

  const raw = headers.join('\r\n') + '\r\n\r\n' + body.body;
  const encoded = btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const payload: Record<string, unknown> = { raw: encoded };
  if (body.threadId) payload.threadId = body.threadId;

  const r = await gmail(ctx!, '/messages/send', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!r.ok) return json({ error: await r.text() }, r.status);
  const sent: any = await r.json();
  return json({ id: sent.id, threadId: sent.threadId, sent_by_user_id: ctx!.userId });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
