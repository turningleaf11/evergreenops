import { createClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const OPENCLAW_GATEWAY_URL = Deno.env.get('OPENCLAW_GATEWAY_URL'); // optional — set when OpenClaw is publicly deployed
const OPENCLAW_GATEWAY_TOKEN = Deno.env.get('OPENCLAW_GATEWAY_TOKEN');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

type LogCategory = 'task_started' | 'task_completed' | 'task_failed' | 'agent_message';

async function logActivity(args: {
  task_id: string;
  agent_id: string | null;
  agent_name: string;
  agent_emoji: string | null;
  category: LogCategory;
  message: string;
}): Promise<void> {
  const { error } = await supabase.from('ai_logs').insert(args);
  if (error) console.warn('[JR Coder] ai_logs insert failed (non-fatal):', error.message);
}

const SYSTEM_PROMPT = `You are JR Coder, a junior software engineer and coding assistant.
Your job is to receive a feature brief or task description and produce a precise, actionable implementation plan.

Your output will be reviewed by a senior engineer (Albus) and then executed by an automated Claude Code agent in GitHub Actions.
This means your plan must be concrete enough for a coding agent to execute without any human clarification.

For each task, your response must include:
1. A brief summary of what needs to be built (2-3 sentences)
2. The exact files that need to be created or modified
3. For each file: the specific changes needed — function names, component names, logic, SQL if applicable
4. Any dependencies or prerequisite steps (e.g. DB migrations before UI changes)
5. Any edge cases or gotchas to watch out for

Be specific. Name actual files, functions, and variables. Do not be vague.
Do not write the actual code — write the plan that tells the coding agent exactly what to write.
End with a one-line summary: "Ready to implement: [brief description]"`;

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const { type, record, old_record } = payload;

    // Only act on tasks assigned to jr-coder moving to pending
    if (type !== 'INSERT' && type !== 'UPDATE') {
      return new Response('ignored', { status: 200 });
    }
    if (record.assigned_to !== 'jr-coder' || record.status !== 'pending') {
      return new Response('ignored', { status: 200 });
    }
    // Avoid re-processing
    if (old_record?.status === 'pending') {
      return new Response('ignored', { status: 200 });
    }

    // Look up agent record once for log enrichment
    const { data: agent } = await supabase
      .from('agents')
      .select('id, name, emoji')
      .eq('slug', 'jr-coder')
      .maybeSingle();

    const agentMeta = {
      task_id: record.id,
      agent_id: agent?.id ?? null,
      agent_name: agent?.name ?? 'JR Coder',
      agent_emoji: agent?.emoji ?? null,
    };

    // Mark as doing
    await supabase
      .from('agent_tasks')
      .update({ status: 'doing', started_at: new Date().toISOString() })
      .eq('id', record.id);

    await logActivity({
      ...agentMeta,
      category: 'task_started',
      message: `Started task: ${record.title ?? record.id}`,
    });

    // Build prompt
    const userMessage = record.context && Object.keys(record.context).length > 0
      ? `${record.description}\n\nAdditional context:\n${JSON.stringify(record.context, null, 2)}`
      : record.description;

    let result: string;
    try {
      // Call Anthropic API
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });

      result = response.content
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { type: string; text: string }) => b.text)
        .join('\n');
    } catch (modelErr) {
      const errMessage = modelErr instanceof Error ? modelErr.message : 'Unknown error';
      await supabase
        .from('agent_tasks')
        .update({ status: 'needs_input', error: errMessage })
        .eq('id', record.id);
      await logActivity({
        ...agentMeta,
        category: 'task_failed',
        message: `Task failed: ${record.title ?? record.id}. Error: ${errMessage}`,
      });
      throw modelErr;
    }

    // Move to review — always, so Albus can approve before GitHub Actions runs
    await supabase
      .from('agent_tasks')
      .update({
        status: 'review',
        result,
        completed_at: new Date().toISOString(),
      })
      .eq('id', record.id);

    await logActivity({
      ...agentMeta,
      category: 'task_completed',
      message: `Completed task: ${record.title ?? record.id}`,
    });
    await logActivity({
      ...agentMeta,
      category: 'agent_message',
      message: result.slice(0, 500),
    });

    console.log(`[JR Coder] Task ${record.id} complete — moved to review`);

    // Notify Albus via OpenClaw system event (fires only when gateway URL is configured)
    if (OPENCLAW_GATEWAY_URL && OPENCLAW_GATEWAY_TOKEN) {
      try {
        await fetch(`${OPENCLAW_GATEWAY_URL}/api/systemEvent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENCLAW_GATEWAY_TOKEN}`,
          },
          body: JSON.stringify({
            type: 'review_task',
            task_id: record.id,
            title: record.title,
            description: record.description,
            result,
          }),
        });
        console.log(`[JR Coder] Notified Albus via OpenClaw for task ${record.id}`);
      } catch (notifyErr) {
        // Non-fatal — task is already in review, Albus will pick it up via heartbeat
        console.warn(`[JR Coder] OpenClaw notification failed (non-fatal):`, notifyErr);
      }
    }

    return new Response('ok', { status: 200 });

  } catch (err) {
    console.error('[JR Coder] Error:', err);
    return new Response('error', { status: 500 });
  }
});
