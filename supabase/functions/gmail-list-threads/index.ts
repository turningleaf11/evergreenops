import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';
import { getGmailContext, gmail } from '../_shared/gmail.ts';

const FOLDER_QUERIES: Record<string, { labelIds?: string[]; q?: string }> = {
  inbox: { labelIds: ['INBOX'] },
  sent: { labelIds: ['SENT'] },
  starred: { labelIds: ['STARRED'] },
  drafts: { labelIds: ['DRAFT'] },
  trash: { labelIds: ['TRASH'] },
  all: {},
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const { ctx, error } = await getGmailContext(req);
  if (error) return json(error.body, error.status);

  const url = new URL(req.url);
  const folder = url.searchParams.get('folder') || 'inbox';
  const q = url.searchParams.get('q') || '';
  const pageToken = url.searchParams.get('pageToken') || '';
  const config = FOLDER_QUERIES[folder] ?? FOLDER_QUERIES.inbox;

  const params = new URLSearchParams({ maxResults: '25' });
  if (config.labelIds) params.set('labelIds', config.labelIds.join(','));
  if (q) params.set('q', q);
  if (pageToken) params.set('pageToken', pageToken);

  const listRes = await gmail(ctx!, `/threads?${params}`);
  if (!listRes.ok) return json({ error: await listRes.text() }, listRes.status);
  const list: { threads?: { id: string; snippet: string; historyId: string }[]; nextPageToken?: string } = await listRes.json();

  // Fetch metadata for each thread (subject + from + date) in parallel
  const threads = await Promise.all((list.threads ?? []).map(async (t) => {
    const r = await gmail(ctx!, `/threads/${t.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);
    if (!r.ok) return null;
    const data: any = await r.json();
    const lastMsg = data.messages?.[data.messages.length - 1];
    const headers: Record<string, string> = {};
    for (const h of lastMsg?.payload?.headers ?? []) headers[h.name.toLowerCase()] = h.value;
    const isUnread = data.messages?.some((m: any) => m.labelIds?.includes('UNREAD'));
    return {
      id: t.id,
      snippet: t.snippet,
      subject: headers.subject || '(no subject)',
      from: headers.from || '',
      date: headers.date || '',
      messageCount: data.messages?.length ?? 1,
      unread: !!isUnread,
      labelIds: lastMsg?.labelIds ?? [],
    };
  }));

  return json({ threads: threads.filter(Boolean), nextPageToken: list.nextPageToken });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
