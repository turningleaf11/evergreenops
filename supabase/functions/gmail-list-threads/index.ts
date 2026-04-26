import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';
import { buildContextForAccount, getGmailContext, gmail, listWorkspaceGmailAccounts } from '../_shared/gmail.ts';

const FOLDER_QUERIES: Record<string, { labelIds?: string[]; q?: string }> = {
  inbox: { labelIds: ['INBOX'] },
  sent: { labelIds: ['SENT'] },
  starred: { labelIds: ['STARRED'] },
  drafts: { labelIds: ['DRAFT'] },
  trash: { labelIds: ['TRASH'] },
  all: {},
};

interface ThreadOut {
  id: string;
  snippet: string;
  subject: string;
  from: string;
  date: string;
  messageCount: number;
  unread: boolean;
  labelIds: string[];
  account_id: string;
  account_email: string;
  account_label: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const folder = url.searchParams.get('folder') || 'inbox';
  const q = url.searchParams.get('q') || '';
  const pageToken = url.searchParams.get('pageToken') || '';
  const accountParam = url.searchParams.get('account_id'); // 'all' | <uuid> | null
  const config = FOLDER_QUERIES[folder] ?? FOLDER_QUERIES.inbox;

  const buildParams = (token?: string) => {
    const p = new URLSearchParams({ maxResults: '25' });
    if (config.labelIds) p.set('labelIds', config.labelIds.join(','));
    if (q) p.set('q', q);
    if (token) p.set('pageToken', token);
    return p;
  };

  // Fan-out across all accounts
  if (accountParam === 'all') {
    const { accounts, admin, userId, workspaceId, error } = await listWorkspaceGmailAccounts(req);
    if (error) return json(error.body, error.status);
    if (!accounts || accounts.length === 0) return json({ threads: [] });

    // Pull each account's full row (need refresh_token_secret_id)
    const { data: full } = await admin!
      .from('gmail_workspace_account')
      .select('id, email, label, refresh_token_secret_id')
      .in('id', accounts.map((a) => a.id));

    const all: ThreadOut[] = [];
    let anyReauth: { account_email: string; account_id: string } | null = null;
    for (const acc of full ?? []) {
      const ctx = await buildContextForAccount(admin!, acc as any, userId!, workspaceId!);
      if (!ctx) {
        anyReauth = { account_email: acc.email, account_id: acc.id };
        continue;
      }
      const threads = await fetchThreadsForCtx(ctx, buildParams(undefined));
      all.push(...threads);
    }

    // Sort merged feed by date desc (parse what Gmail gave us; fallback to 0)
    all.sort((a, b) => Date.parse(b.date || '') - Date.parse(a.date || ''));

    return json({
      threads: all,
      reauth_needed: anyReauth, // surface so UI can offer Reconnect for the affected account
    });
  }

  // Single-account path (default account or explicit ?account_id=<uuid>)
  const { ctx, error } = await getGmailContext(req, {
    accountId: accountParam ?? undefined,
  });
  if (error) return json(error.body, error.status);

  const threads = await fetchThreadsForCtx(ctx!, buildParams(pageToken));
  // We need nextPageToken from the raw list call for single-account paging.
  // Fetch list call once more here just to grab pageToken:
  const listRes = await gmail(ctx!, `/threads?${buildParams(pageToken)}`);
  let nextPageToken: string | undefined;
  if (listRes.ok) {
    const list: any = await listRes.json();
    nextPageToken = list.nextPageToken;
  }
  return json({ threads, nextPageToken });
});

async function fetchThreadsForCtx(
  ctx: import('../_shared/gmail.ts').GmailContext,
  params: URLSearchParams,
): Promise<ThreadOut[]> {
  const listRes = await gmail(ctx, `/threads?${params}`);
  if (!listRes.ok) return [];
  const list: { threads?: { id: string; snippet: string; historyId: string }[] } = await listRes.json();
  const out = await Promise.all((list.threads ?? []).map(async (t) => {
    const r = await gmail(ctx, `/threads/${t.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);
    if (!r.ok) return null;
    const data: any = await r.json();
    const lastMsg = data.messages?.[data.messages.length - 1];
    const headers: Record<string, string> = {};
    for (const h of lastMsg?.payload?.headers ?? []) headers[h.name.toLowerCase()] = h.value;
    const isUnread = data.messages?.some((m: any) => m.labelIds?.includes('UNREAD'));
    const thread: ThreadOut = {
      id: t.id,
      snippet: t.snippet,
      subject: headers.subject || '(no subject)',
      from: headers.from || '',
      date: headers.date || '',
      messageCount: data.messages?.length ?? 1,
      unread: !!isUnread,
      labelIds: lastMsg?.labelIds ?? [],
      account_id: ctx.accountId,
      account_email: ctx.email,
      account_label: ctx.accountLabel,
    };
    return thread;
  }));
  return out.filter(Boolean) as ThreadOut[];
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
