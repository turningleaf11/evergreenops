import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';
import { getGmailContext, gmail } from '../_shared/gmail.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const { ctx, error } = await getGmailContext(req);
  if (error) return json(error.body, error.status);

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'Missing id' }, 400);

  const r = await gmail(ctx!, `/threads/${id}?format=full`);
  if (!r.ok) return json({ error: await r.text() }, r.status);
  const data: any = await r.json();

  const messages = (data.messages ?? []).map((m: any) => {
    const headers: Record<string, string> = {};
    for (const h of m.payload?.headers ?? []) headers[h.name.toLowerCase()] = h.value;
    return {
      id: m.id,
      threadId: m.threadId,
      snippet: m.snippet,
      labelIds: m.labelIds ?? [],
      headers,
      bodyHtml: extractBody(m.payload, 'text/html'),
      bodyText: extractBody(m.payload, 'text/plain'),
      attachments: extractAttachments(m.payload),
      internalDate: m.internalDate,
    };
  });

  return json({ id: data.id, messages });
});

// Collect real attachments (parts that carry a filename + attachmentId).
// Inline images referenced by cid: are skipped here.
function extractAttachments(payload: any, out: any[] = []): any[] {
  if (!payload) return out;
  const filename = payload.filename;
  const attachmentId = payload.body?.attachmentId;
  if (filename && attachmentId) {
    out.push({
      filename,
      mimeType: payload.mimeType ?? 'application/octet-stream',
      size: payload.body?.size ?? null,
      attachmentId,
    });
  }
  if (Array.isArray(payload.parts)) {
    for (const p of payload.parts) extractAttachments(p, out);
  }
  return out;
}

function extractBody(payload: any, mimeType: string): string {
  if (!payload) return '';
  if (payload.mimeType === mimeType && payload.body?.data) return decode(payload.body.data);
  if (Array.isArray(payload.parts)) {
    for (const p of payload.parts) {
      const found = extractBody(p, mimeType);
      if (found) return found;
    }
  }
  return '';
}

function decode(data: string): string {
  try {
    const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(escape(atob(b64)));
  } catch {
    return '';
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
