// email-sync-thread
// -----------------
// Materializes a Gmail thread's messages onto a CRM record's activity timeline.
// This is the association model the app uses: a user links a specific thread to
// an opportunity (crm_transactions) and/or contact via "Link to CRM", and every
// message in that thread -- inbound and outbound -- then appears on that record.
//
// Idempotent: each message is deduped by its gmail_message_id, so re-running the
// sync (on link, on deal open, or from the ongoing poll) only inserts new
// messages. Safe to call repeatedly.
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';
import { getGmailContext, gmail } from '../_shared/gmail.ts';

interface SyncBody {
  thread_id: string;
  entity_type: string; // "transaction" | "contact" | ...
  entity_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const body: SyncBody = await req.json();
  if (!body.thread_id || !body.entity_type || !body.entity_id) {
    return json({ error: 'thread_id, entity_type and entity_id are required' }, 400);
  }

  const { ctx, error } = await getGmailContext(req);
  if (error) return json(error.body, error.status);

  const r = await gmail(ctx!, `/threads/${body.thread_id}?format=full`);
  if (!r.ok) return json({ error: await r.text() }, r.status);
  const data: any = await r.json();
  const rawMessages: any[] = data.messages ?? [];

  // What have we already stored for this record + thread? Dedup by message id.
  const { data: existingRows } = await ctx!.admin
    .from('crm_activities')
    .select('metadata')
    .eq('entity_type', body.entity_type)
    .eq('entity_id', body.entity_id)
    .eq('type', 'email');
  const seen = new Set<string>();
  for (const row of (existingRows ?? []) as any[]) {
    const mid = row?.metadata?.gmail_message_id;
    if (mid) seen.add(String(mid));
  }

  const account = (ctx!.email || '').toLowerCase();
  const toInsert: any[] = [];

  for (const m of rawMessages) {
    if (seen.has(String(m.id))) continue;

    const headers: Record<string, string> = {};
    for (const h of m.payload?.headers ?? []) headers[h.name.toLowerCase()] = h.value;

    const from = headers['from'] ?? '';
    const to = headers['to'] ?? '';
    const subject = headers['subject'] ?? '(no subject)';
    const outbound = from.toLowerCase().includes(account);
    const bodyHtml = extractBody(m.payload, 'text/html');
    const bodyText = extractBody(m.payload, 'text/plain');
    const occurredAt = m.internalDate
      ? new Date(Number(m.internalDate)).toISOString()
      : new Date().toISOString();

    toInsert.push({
      workspace_id: ctx!.workspaceId,
      entity_type: body.entity_type,
      entity_id: body.entity_id,
      type: 'email',
      subject,
      body: bodyHtml || bodyText || m.snippet || '',
      actor_id: outbound ? ctx!.userId : null,
      occurred_at: occurredAt,
      metadata: {
        direction: outbound ? 'outbound' : 'inbound',
        from,
        to,
        gmail_thread_id: m.threadId,
        gmail_message_id: m.id,
        synced: true,
      },
    });
  }

  if (toInsert.length > 0) {
    const { error: insErr } = await ctx!.admin.from('crm_activities').insert(toInsert);
    if (insErr) return json({ error: insErr.message }, 500);
  }

  return json({ inserted: toInsert.length, total: rawMessages.length });
});

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

function decode(dataStr: string): string {
  try {
    const b64 = dataStr.replace(/-/g, '+').replace(/_/g, '/');
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
