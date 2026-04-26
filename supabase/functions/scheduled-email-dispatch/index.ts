// Sends scheduled emails whose send_at <= now() using the workspace Gmail account.
// Cron-driven (verify_jwt = false). Mirrors the auth model used by gmail-send.
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');

interface ScheduledRow {
  id: string;
  workspace_id: string;
  user_id: string;
  to_email: string;
  cc: string | null;
  bcc: string | null;
  subject: string;
  body_html: string;
  thread_id: string | null;
  in_reply_to: string | null;
  attempts: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const nowIso = new Date().toISOString();

  const { data: due, error: queryError } = await admin
    .from('scheduled_emails')
    .select('*')
    .eq('status', 'pending')
    .lte('send_at', nowIso)
    .lt('attempts', 3)
    .order('send_at', { ascending: true })
    .limit(25);

  if (queryError) return json({ error: queryError.message }, 500);

  // Cache resolved Gmail accounts per workspace within this run.
  const accessTokenCache = new Map<string, { token: string; from: string } | null>();

  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const row of (due || []) as ScheduledRow[]) {
    try {
      let acct = accessTokenCache.get(row.workspace_id);
      if (acct === undefined) {
        acct = await resolveWorkspaceGmail(admin, row.workspace_id);
        accessTokenCache.set(row.workspace_id, acct);
      }
      if (!acct) {
        await markFailed(admin, row, 'Workspace Gmail not connected', true);
        results.push({ id: row.id, status: 'failed', error: 'no_gmail' });
        continue;
      }

      const sendRes = await sendViaGmail(acct.token, acct.from, row);
      if (sendRes.ok) {
        await admin
          .from('scheduled_emails')
          .update({
            status: 'sent',
            sent_message_id: sendRes.id,
            sent_thread_id: sendRes.threadId,
            attempts: row.attempts + 1,
          })
          .eq('id', row.id);
        results.push({ id: row.id, status: 'sent' });
      } else {
        await markFailed(admin, row, sendRes.error, row.attempts + 1 >= 3);
        results.push({ id: row.id, status: 'failed', error: sendRes.error });
      }
    } catch (e) {
      await markFailed(admin, row, String((e as Error).message), row.attempts + 1 >= 3);
      results.push({ id: row.id, status: 'failed', error: String((e as Error).message) });
    }
  }

  return json({ processed: results.length, results });
});

async function markFailed(
  admin: ReturnType<typeof createClient>,
  row: ScheduledRow,
  error: string,
  terminal: boolean,
) {
  await admin
    .from('scheduled_emails')
    .update({
      status: terminal ? 'failed' : 'pending',
      error,
      attempts: row.attempts + 1,
    })
    .eq('id', row.id);
}

async function resolveWorkspaceGmail(
  admin: ReturnType<typeof createClient>,
  workspaceId: string,
): Promise<{ token: string; from: string } | null> {
  const { data: account } = await admin
    .from('gmail_workspace_account')
    .select('email, refresh_token_secret_id')
    .eq('workspace_id', workspaceId)
    .is('revoked_at', null)
    .maybeSingle();
  if (!account) return null;

  const { data: tok } = await admin
    .from('gmail_tokens')
    .select('refresh_token')
    .eq('id', account.refresh_token_secret_id as string)
    .maybeSingle();
  if (!tok?.refresh_token) return null;

  const accessToken = await refreshAccessToken(tok.refresh_token as string);
  if (!accessToken) return null;
  return { token: accessToken, from: account.email as string };
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!r.ok) return null;
  const t: any = await r.json();
  return t.access_token ?? null;
}

interface SendOk { ok: true; id?: string; threadId?: string }
interface SendErr { ok: false; error: string; id?: undefined; threadId?: undefined }

async function sendViaGmail(
  accessToken: string,
  fromEmail: string,
  row: ScheduledRow,
): Promise<SendOk | SendErr> {
  const headers: string[] = [
    `From: ${fromEmail}`,
    `To: ${row.to_email}`,
    row.cc ? `Cc: ${row.cc}` : '',
    row.bcc ? `Bcc: ${row.bcc}` : '',
    `Subject: ${row.subject}`,
    row.in_reply_to ? `In-Reply-To: ${row.in_reply_to}` : '',
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
  ].filter(Boolean);

  const raw = headers.join('\r\n') + '\r\n\r\n' + row.body_html;
  const encoded = btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const payload: Record<string, unknown> = { raw: encoded };
  if (row.thread_id) payload.threadId = row.thread_id;

  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) return { ok: false, error: await r.text() };
  const sent: any = await r.json();
  return { ok: true, id: sent.id, threadId: sent.threadId };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
