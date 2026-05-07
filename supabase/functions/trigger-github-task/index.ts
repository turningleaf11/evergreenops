import { createClient } from 'jsr:@supabase/supabase-js@2';

const GITHUB_PAT = Deno.env.get('GITHUB_PAT')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  try {
    const payload = await req.json();

    // Supabase DB webhook sends { type, table, record, old_record }
    const { type, record, old_record } = payload;

    // Only act on UPDATE events where status just changed to 'approved'
    if (type !== 'UPDATE') {
      return new Response('ignored', { status: 200 });
    }
    if (record.status !== 'approved' || old_record?.status === 'approved') {
      return new Response('ignored', { status: 200 });
    }
    if (!record.repo) {
      console.error(`Task ${record.id} has no repo set — cannot trigger workflow`);
      return new Response('no repo', { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Look up the repo
    const { data: repo, error: repoError } = await supabase
      .from('repos')
      .select('github_repo')
      .eq('slug', record.repo)
      .single();

    if (repoError || !repo) {
      console.error(`Repo not found: ${record.repo}`);
      return new Response('repo not found', { status: 200 });
    }

    // Trigger GitHub Actions workflow_dispatch
    const response = await fetch(
      `https://api.github.com/repos/${repo.github_repo}/actions/workflows/claude-task.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GITHUB_PAT}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            task_id: record.id,
            task_title: record.title,
            task_description: record.result ?? record.description,
            task_notes: record.notes ?? '',
          },
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`GitHub API error ${response.status}: ${text}`);
      // Mark task as needs_input so Albus knows something went wrong
      await supabase
        .from('agent_tasks')
        .update({ status: 'needs_input', error: `Failed to trigger GitHub Actions: ${response.status} ${text}` })
        .eq('id', record.id);
      return new Response('github error', { status: 200 });
    }

    console.log(`Triggered workflow for task ${record.id} on ${repo.github_repo}`);
    return new Response('ok', { status: 200 });

  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response('error', { status: 500 });
  }
});
