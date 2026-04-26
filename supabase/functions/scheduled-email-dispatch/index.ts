// Sends scheduled emails whose send_at <= now() via the user's connected Gmail.
// Triggered by pg_cron every minute (no JWT verification — cron-driven).
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

  if (queryError) {
    return json({ error: queryError.message }, 500);
  }

  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const row of (due || []) as ScheduledRow[]) {
    try {
      // Fetch the sender's Gmail tokens (managed by gmail-* edge functions).
      const { data: tokens } = await admin
        .from('gmail_tokens')
        .select('user_email')
        .eq('user_id', row.user_id)
        .maybeSingle();

      if (!tokens) {
        await admin
          .from('scheduled_emails')
          .update({
            status: 'failed',
            error: 'No connected Gmail account for sender',
            attempts: row.attempts + 1,
          })
          .eq('id', row.id);
        results.push({ id: row.id, status: 'failed', error: 'no_gmail' });
        continue;
      }

      const sendRes = await sendViaGmail(admin, row);
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
        await admin
          .from('scheduled_emails')
          .update({
            status: row.attempts + 1 >= 3 ? 'failed' : 'pending',
            error: sendRes.error,
            attempts: row.attempts + 1,
          })
          .eq('id', row.id);
        results.push({ id: row.id, status: 'failed', error: sendRes.error });
      }
    } catch (e) {
      await admin
        .from('scheduled_emails')
        .update({
          status: row.attempts + 1 >= 3 ? 'failed' : 'pending',
          error: String((e as Error).message),
          attempts: row.attempts + 1,
        })
        .eq('id', row.id);
      results.push({ id: row.id, status: 'failed', error: String((e as Error).message) });
    }
  }

  return json({ processed: results.length, results });
});

interface SendOk { ok: true; id?: string; threadId?: string }
interface SendErr { ok: false; error: string; id?: undefined; threadId?: undefined }

async function sendViaGmail(
  admin: ReturnType<typeof createClient>,
  row: ScheduledRow,
): Promise<SendOk | SendErr> {
  // Fetch full token row including refresh_token + access_token + expiry.
  const { data: tok } = await admin
    .from('gmail_tokens')
    .select('access_token,refresh_token,expires_at,user_email')
    .eq('user_id', row.user_id)
    .maybeSingle();

  if (!tok?.refresh_token) return { ok: false, error: 'No Gmail refresh token' };

  let accessToken = tok.access_token as string | null;
  const expiresAt = tok.expires_at ? new Date(tok.expires_at as string).getTime() : 0;
  if (!accessToken || expiresAt - Date.now() < 60_000) {
    const refreshed = await refreshAccessToken(tok.refresh_token as string);
    if (!refreshed.ok) return { ok: false, error: refreshed.error };
    accessToken = refreshed.access_token;
    await admin
      .from('gmail_tokens')
      .update({
        access_token: accessToken,
        expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      })
      .eq('user_id', row.user_id);
  }

  const headers: string[] = [
    `From: ${tok.user_email}`,
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

async function refreshAccessToken(refreshToken: string):
  Promise<{ ok: true; access_token: string; expires_in: number } | { ok: false; error: string }> {
  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
  if (!clientId || !clientSecret) return { ok: false, error: 'Google OAuth not configured' };
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!r.ok) return { ok: false, error: await r.text() };
  const t: any = await r.json();
  return { ok: true, access_token: t.access_token, expires_in: t.expires_in ?? 3600 };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
