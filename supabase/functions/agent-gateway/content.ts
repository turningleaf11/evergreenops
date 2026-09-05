// Marquetta's content capabilities.
//
// Every function here is a bounded business operation, never table access. The
// Gateway derives workspace_id and created_by_agent_id from the authenticated
// context; Marquetta never supplies them and cannot spoof them.
//
// Three limits are enforced HERE rather than in the skill prompt, because a
// prompt is a suggestion:
//
//   saveDraft         forces status='draft' and does not accept a status input
//                     at all. content_library.status allows approved and
//                     posted; an agent must not be able to reach either.
//   proposeExemplar   forces status='candidate'. An agent that can promote its
//                     own voice exemplars curates the corpus that judges it.
//   proposeSchedule   accepts only draft or review. 'released' is the
//                     publication authority boundary and belongs to a human;
//                     the publish worker refuses anything not released.
//
// There is deliberately no brand write and no deal read. Brands carry the
// voice, audience and mission that govern the agent, so letting her edit them
// lets her edit her own policy. Deals were removed entirely — see
// docs/marquetta-content-engine.md.

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';

export class ContentError extends Error {
  constructor(public status: number, public code: string, message = code) {
    super(message);
    this.name = 'ContentError';
  }
}

type Row = Record<string, unknown>;
const fail = (error: unknown, code: string) => {
  if (error) {
    console.error(JSON.stringify({ event: 'agent_gateway_content_error', code }));
    throw new ContentError(500, code);
  }
};

// ---------------------------------------------------------------------------
// Task queue — generic over agents.slug so Cash, Ema and Dex can adopt the same
// claim path. The atomic lease and the review/blocked ceiling live in the RPCs
// (20260905193000), not here.
// ---------------------------------------------------------------------------

export async function claimNextTask(admin: SupabaseClient, workspaceId: string, agentSlug: string): Promise<Row> {
  const { data, error } = await admin.rpc('agent_task_claim_next', {
    p_agent_slug: agentSlug,
    p_workspace_id: workspaceId,
    p_lease_seconds: 900,
  });
  fail(error, 'task_claim_failed');
  const rows = (data ?? []) as Row[];
  // No work is a successful run, not an error. Callers must treat it as such.
  return rows.length ? { task: rows[0] } : { task: null };
}

export async function submitTaskResult(
  admin: SupabaseClient,
  workspaceId: string,
  agentSlug: string,
  input: Row,
): Promise<Row> {
  const { data, error } = await admin.rpc('agent_task_submit_result', {
    p_agent_slug: agentSlug,
    p_workspace_id: workspaceId,
    p_task_id: String(input.task_id),
    p_result: String(input.result),
    p_status: String(input.status ?? 'review'),
    p_error: input.error === undefined || input.error === null ? null : String(input.error),
  });
  // A rejected transition is the ceiling doing its job — surface it as a 403 so
  // it reads as "not allowed" rather than "broken".
  if (error) {
    const message = String((error as { message?: string }).message ?? '');
    if (message.includes('may only submit')) throw new ContentError(403, 'status_ceiling_exceeded');
    if (message.includes('not leased by')) throw new ContentError(409, 'task_not_leased_by_agent');
    fail(error, 'task_submit_failed');
  }
  return { status: data };
}

// ---------------------------------------------------------------------------
// Capture — read side of lane 1. Only tasks explicitly flagged
// content_capture_eligible, returned as a sanitized projection.
// ---------------------------------------------------------------------------

export async function listTaskEvents(admin: SupabaseClient, workspaceId: string, agentSlug: string, input: Row): Promise<Row> {
  const { data, error } = await admin.rpc('content_capture_list_task_events', {
    p_agent_slug: agentSlug,
    p_workspace_id: workspaceId,
    p_since: input.since ?? null,
    p_limit: input.limit ?? 25,
  });
  fail(error, 'capture_task_events_failed');
  return { events: data ?? [] };
}

// ---------------------------------------------------------------------------
// Brands — READ ONLY. See the header.
// ---------------------------------------------------------------------------

export async function readBrands(admin: SupabaseClient, workspaceId: string): Promise<Row> {
  const { data, error } = await admin
    .from('content_brands')
    .select('id, name, audience, voice, mission, seeds, color')
    .eq('workspace_id', workspaceId)
    .order('sort_order', { ascending: true, nullsFirst: false });
  fail(error, 'brands_read_failed');
  return { brands: data ?? [] };
}

export async function listPillars(admin: SupabaseClient, workspaceId: string, input: Row): Promise<Row> {
  let query = admin
    .from('content_pillars')
    .select('id, brand_id, key, label, target_pct, framing_note')
    .eq('workspace_id', workspaceId)
    .order('sort_order');
  if (input.brand_id) query = query.eq('brand_id', String(input.brand_id));
  const { data, error } = await query;
  fail(error, 'pillars_read_failed');
  return { pillars: data ?? [] };
}

// ---------------------------------------------------------------------------
// Seeds — lane 1 write. Idempotent on (workspace, source, source_ref) so an
// hourly cron cannot re-capture the same event.
// ---------------------------------------------------------------------------

export async function listSeeds(admin: SupabaseClient, workspaceId: string, input: Row): Promise<Row> {
  let query = admin
    .from('content_seeds')
    .select('id, brand_id, pillar_id, source, source_ref, raw, angle, score, status, created_at')
    .eq('workspace_id', workspaceId)
    .order('score', { ascending: false })
    .limit(Number(input.limit ?? 25));
  if (input.brand_id) query = query.eq('brand_id', String(input.brand_id));
  if (input.status) query = query.eq('status', String(input.status));
  const { data, error } = await query;
  fail(error, 'seeds_read_failed');
  return { seeds: data ?? [] };
}

export async function saveSeed(admin: SupabaseClient, workspaceId: string, agentId: string, input: Row): Promise<Row> {
  const row = {
    workspace_id: workspaceId,
    created_by_agent_id: agentId,
    brand_id: input.brand_id ?? null,
    pillar_id: input.pillar_id ?? null,
    source: String(input.source),
    source_ref: input.source_ref ?? null,
    raw: String(input.raw),
    angle: input.angle ?? null,
    score: Number(input.score ?? 0),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await admin
    .from('content_seeds')
    .upsert(row, { onConflict: 'workspace_id,source,source_ref' })
    .select('id, status')
    .single();
  fail(error, 'seed_save_failed');
  return { seed: data };
}

// ---------------------------------------------------------------------------
// Research — content and marketing only. Real estate research is Cash's.
// ---------------------------------------------------------------------------

export async function listResearch(admin: SupabaseClient, workspaceId: string, input: Row): Promise<Row> {
  let query = admin
    .from('content_research')
    .select('id, brand_id, topic, finding, source_url, is_sourced, expires_at, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(Number(input.limit ?? 25));
  if (input.brand_id) query = query.eq('brand_id', String(input.brand_id));
  // Drafting from a stale trend is worse than not drafting.
  if (input.include_expired !== true) query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  const { data, error } = await query;
  fail(error, 'research_read_failed');
  return { research: data ?? [] };
}

export async function saveResearch(admin: SupabaseClient, workspaceId: string, agentId: string, input: Row): Promise<Row> {
  const sourceUrl = input.source_url ? String(input.source_url) : null;
  const { data, error } = await admin
    .from('content_research')
    .insert({
      workspace_id: workspaceId,
      created_by_agent_id: agentId,
      brand_id: input.brand_id ?? null,
      topic: String(input.topic),
      finding: String(input.finding),
      source_url: sourceUrl,
      // A finding without a source is an opinion. Recorded as such rather than
      // rejected, so the reviewer can see it was unsourced.
      is_sourced: Boolean(sourceUrl),
      expires_at: input.expires_at ?? null,
    })
    .select('id, is_sourced')
    .single();
  fail(error, 'research_save_failed');
  return { research: data };
}

// ---------------------------------------------------------------------------
// Library — draft only.
// ---------------------------------------------------------------------------

export async function listLibrary(admin: SupabaseClient, workspaceId: string, input: Row): Promise<Row> {
  let query = admin
    .from('content_library')
    .select('id, brand_id, brand_name, pillar_id, seed_id, platform, content, status, image_url, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(Number(input.limit ?? 25));
  if (input.brand_id) query = query.eq('brand_id', String(input.brand_id));
  if (input.status) query = query.eq('status', String(input.status));
  const { data, error } = await query;
  fail(error, 'library_read_failed');
  return { content: data ?? [] };
}

export async function saveDraft(admin: SupabaseClient, workspaceId: string, agentId: string, input: Row): Promise<Row> {
  const { data, error } = await admin
    .from('content_library')
    .insert({
      workspace_id: workspaceId,
      created_by_agent_id: agentId,
      brand_id: input.brand_id ?? null,
      pillar_id: input.pillar_id ?? null,
      seed_id: input.seed_id ?? null,
      platform: String(input.platform),
      content: String(input.content),
      image_url: input.image_url ?? null,
      source_video_url: input.source_video_url ?? null,
      clip_range: input.clip_range ?? null,
      // Not from input, and input carries no status field. This is the ceiling.
      status: 'draft',
    })
    .select('id, status')
    .single();
  fail(error, 'draft_save_failed');
  return { draft: data };
}

// ---------------------------------------------------------------------------
// Voice exemplars — propose only, never promote.
// ---------------------------------------------------------------------------

export async function listExemplars(admin: SupabaseClient, workspaceId: string, input: Row): Promise<Row> {
  let query = admin
    .from('content_voice_exemplars')
    .select('id, brand_id, platform, text, is_positive, status')
    .eq('workspace_id', workspaceId)
    .limit(Number(input.limit ?? 50));
  if (input.brand_id) query = query.eq('brand_id', String(input.brand_id));
  // Only approved exemplars are reference material. Candidates are pending
  // human judgement and must not steer drafting yet.
  query = query.eq('status', input.status ? String(input.status) : 'approved');
  const { data, error } = await query;
  fail(error, 'exemplars_read_failed');
  return { exemplars: data ?? [] };
}

export async function proposeExemplar(admin: SupabaseClient, workspaceId: string, agentId: string, input: Row): Promise<Row> {
  const { data, error } = await admin
    .from('content_voice_exemplars')
    .insert({
      workspace_id: workspaceId,
      proposed_by_agent_id: agentId,
      brand_id: String(input.brand_id),
      platform: input.platform ?? null,
      text: String(input.text),
      is_positive: input.is_positive === undefined ? true : Boolean(input.is_positive),
      status: 'candidate', // not from input
    })
    .select('id, status')
    .single();
  fail(error, 'exemplar_propose_failed');
  return { exemplar: data };
}

// ---------------------------------------------------------------------------
// Schedule — proposal, never release.
// ---------------------------------------------------------------------------

export async function listSchedule(admin: SupabaseClient, workspaceId: string, input: Row): Promise<Row> {
  let query = admin
    .from('content_schedule')
    .select('id, brand_id, content_id, platform, scheduled_for, status, published_url, metrics, rejection_reason')
    .eq('workspace_id', workspaceId)
    .order('scheduled_for', { ascending: true, nullsFirst: false })
    .limit(Number(input.limit ?? 50));
  if (input.brand_id) query = query.eq('brand_id', String(input.brand_id));
  if (input.status) query = query.eq('status', String(input.status));
  const { data, error } = await query;
  fail(error, 'schedule_read_failed');
  return { schedule: data ?? [] };
}

export async function proposeSchedule(admin: SupabaseClient, workspaceId: string, agentId: string, input: Row): Promise<Row> {
  const status = String(input.status ?? 'draft');
  // Belt and braces: the parser restricts this too, but creating a row must
  // never constitute release authority however the call arrives.
  if (status !== 'draft' && status !== 'review') throw new ContentError(403, 'release_requires_human');
  const { data, error } = await admin
    .from('content_schedule')
    .upsert(
      {
        workspace_id: workspaceId,
        created_by_agent_id: agentId,
        brand_id: input.brand_id ?? null,
        content_id: String(input.content_id),
        platform: String(input.platform),
        scheduled_for: input.scheduled_for ?? null,
        review_assignee: input.review_assignee ?? null,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'content_id,platform' },
    )
    .select('id, status')
    .single();
  fail(error, 'schedule_propose_failed');
  return { scheduled: data };
}
