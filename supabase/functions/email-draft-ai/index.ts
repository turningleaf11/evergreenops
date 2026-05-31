// Drafts an email body using Lovable AI based on the lead/contact context.
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';

interface DraftBody {
  recipientName?: string;
  recipientEmail?: string;
  company?: string;
  context?: string; // free-form (e.g. "first cold outreach for SaaS demo")
  goal?: string;    // e.g. "book a 20-min call next week"
  tone?: string;    // friendly | direct | formal (default: friendly)
  threadSnippet?: string; // last message in thread when replying
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return json({ error: 'AI not configured' }, 500);

  let body: DraftBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const tone = body.tone || 'friendly, professional';
  const ctx = [
    body.recipientName ? `Recipient: ${body.recipientName}` : '',
    body.recipientEmail ? `Email: ${body.recipientEmail}` : '',
    body.company ? `Company: ${body.company}` : '',
    body.context ? `Context: ${body.context}` : '',
    body.goal ? `Goal of this email: ${body.goal}` : '',
    body.threadSnippet ? `Previous message:\n${body.threadSnippet.slice(0, 1200)}` : '',
  ].filter(Boolean).join('\n');

  const prompt = `You are drafting a short business email on behalf of a sales/CRM user.

${ctx || '(No extra context provided.)'}

Rules:
- Tone: ${tone}.
- Keep it concise (3-5 short sentences).
- Open with a personal greeting using the recipient's first name when available.
- End with a clear, single call-to-action.
- Sign off with "Best,".
- Output STRICT JSON: {"subject": "...", "body_html": "<p>...</p><p>...</p>"}.
- body_html must be valid HTML using <p>, <br>, <ul><li>, <strong>, <em> only.
- Do NOT include greetings inside body_html that duplicate the subject.
- Do NOT include placeholder tokens like [Name] â€” use the provided name or omit.`;

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You write concise, high-converting business emails. Always reply with strict JSON.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!r.ok) {
    const text = await r.text();
    return json({ error: `AI request failed: ${text.slice(0, 300)}` }, 502);
  }

  const data: any = await r.json();
  const content = data?.choices?.[0]?.message?.content || '{}';
  let parsed: { subject?: string; body_html?: string } = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    return json({ error: 'AI returned invalid JSON', raw: content }, 502);
  }

  return json({
    subject: parsed.subject || '',
    body_html: parsed.body_html || '',
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
