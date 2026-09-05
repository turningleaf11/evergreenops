import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { parseGatewayRequest, RequestValidationError, summarizeGatewayInput } from './core.ts';

const BRAND = '11111111-1111-4111-8111-111111111111';
const CONTENT = '22222222-2222-4222-8222-222222222222';
const TASK = '33333333-3333-4333-8333-333333333333';

// The status ceiling has to be unreachable from every direction, not just the
// one we thought of. It is enforced in the RPC, in content.ts and here in the
// parser; this test covers the parser.
Deno.test('agents cannot submit approved or done', () => {
  for (const status of ['approved', 'done', 'cancelled', 'in_progress']) {
    assertThrows(
      () => parseGatewayRequest({ action: 'agent_tasks.submit_result', input: { task_id: TASK, result: 'x', status } }),
      RequestValidationError,
    );
  }
  const review = parseGatewayRequest({ action: 'agent_tasks.submit_result', input: { task_id: TASK, result: 'done it' } });
  assertEquals(review.input.status, 'review');
  const blocked = parseGatewayRequest({ action: 'agent_tasks.submit_result', input: { task_id: TASK, result: 'stuck', status: 'blocked' } });
  assertEquals(blocked.input.status, 'blocked');
});

Deno.test('a task result cannot be empty and is length bounded', () => {
  assertThrows(() => parseGatewayRequest({ action: 'agent_tasks.submit_result', input: { task_id: TASK, result: '' } }), RequestValidationError);
  assertThrows(() => parseGatewayRequest({ action: 'agent_tasks.submit_result', input: { task_id: TASK, result: 'x'.repeat(20001) } }), RequestValidationError);
});

// content_library.status permits approved and posted. An agent must not be able
// to reach either, so the draft action carries no status field at all — a
// supplied one is silently absent from the parsed input rather than honoured.
Deno.test('save_draft has no status input to raise', () => {
  const parsed = parseGatewayRequest({
    action: 'content.library.save_draft',
    input: { brand_id: BRAND, platform: 'instagram', content: 'the cat again', status: 'approved', posted: true },
  });
  assertEquals('status' in parsed.input, false);
  assertEquals(parsed.input.platform, 'instagram');
});

Deno.test('save_draft rejects unknown platforms and empty content', () => {
  assertThrows(() => parseGatewayRequest({ action: 'content.library.save_draft', input: { platform: 'myspace', content: 'x' } }), RequestValidationError);
  assertThrows(() => parseGatewayRequest({ action: 'content.library.save_draft', input: { platform: 'instagram', content: '' } }), RequestValidationError);
});

// An agent that can promote its own voice exemplars curates the corpus that
// judges it.
Deno.test('voice exemplars can only be proposed, never promoted', () => {
  const parsed = parseGatewayRequest({
    action: 'content.voice_exemplars.propose',
    input: { brand_id: BRAND, text: "Ok, I'll play", status: 'approved' },
  });
  assertEquals('status' in parsed.input, false);
  assertEquals(parsed.input.is_positive, true);
});

Deno.test('a counter-example exemplar is expressible', () => {
  const parsed = parseGatewayRequest({
    action: 'content.voice_exemplars.propose',
    input: { brand_id: BRAND, text: '5 ways AI is changing real estate', is_positive: false },
  });
  assertEquals(parsed.input.is_positive, false);
});

// Creating a schedule row must never constitute release authority.
Deno.test('scheduling cannot reach released or published', () => {
  for (const status of ['released', 'publishing', 'published', 'failed']) {
    assertThrows(
      () => parseGatewayRequest({ action: 'content.schedule.propose', input: { content_id: CONTENT, platform: 'facebook', status } }),
      RequestValidationError,
    );
  }
  const parsed = parseGatewayRequest({ action: 'content.schedule.propose', input: { content_id: CONTENT, platform: 'facebook' } });
  assertEquals(parsed.input.status, 'draft');
});

// These are stored and later rendered in the Content Studio.
Deno.test('urls must be http or https', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>', 'file:///etc/passwd']) {
    assertThrows(
      () => parseGatewayRequest({ action: 'content.library.save_draft', input: { platform: 'blog', content: 'x', image_url: url } }),
      RequestValidationError,
    );
  }
  const ok = parseGatewayRequest({ action: 'content.library.save_draft', input: { platform: 'blog', content: 'x', image_url: 'https://example.com/a.jpg' } });
  assertEquals(ok.input.image_url, 'https://example.com/a.jpg');
});

Deno.test('seed sources are a closed set and capture is bounded', () => {
  assertThrows(() => parseGatewayRequest({ action: 'content.seeds.save', input: { source: 'wiretap', raw: 'x' } }), RequestValidationError);
  assertThrows(() => parseGatewayRequest({ action: 'content.seeds.save', input: { raw: 'x' } }), RequestValidationError);
  const parsed = parseGatewayRequest({ action: 'content.seeds.save', input: { source: 'manual', raw: 'made carbonara', score: 40 } });
  assertEquals(parsed.input.source, 'manual');
  assertThrows(() => parseGatewayRequest({ action: 'content.capture.list_task_events', input: { limit: 500 } }), RequestValidationError);
});

Deno.test('next_assigned takes no caller-supplied identity', () => {
  assertThrows(() => parseGatewayRequest({ action: 'agent_tasks.next_assigned', input: { agent_slug: 'cash' } }), RequestValidationError);
  assertEquals(parseGatewayRequest({ action: 'agent_tasks.next_assigned', input: {} }).input, {});
});

// The audit log records that a call happened and with what shape. It must never
// carry post text, research findings or exemplar content — those would end up
// in a security log that is read by people who do not need them.
Deno.test('audit summaries carry shape, never content', () => {
  const secret = 'the cat sat on the 1109 Riviera closing statement';
  const cases = [
    { action: 'content.library.save_draft', input: { platform: 'instagram', content: secret } },
    { action: 'content.voice_exemplars.propose', input: { brand_id: BRAND, text: secret } },
    { action: 'content.research.save', input: { topic: 'x', finding: secret } },
    { action: 'content.seeds.save', input: { source: 'manual', raw: secret } },
    { action: 'agent_tasks.submit_result', input: { task_id: TASK, result: secret } },
  ];
  for (const c of cases) {
    const parsed = parseGatewayRequest(c);
    const summary = summarizeGatewayInput(parsed);
    const serialized = JSON.stringify(summary);
    assertEquals(serialized.includes(secret), false, `${c.action} leaked content into the audit log`);
    assertEquals(serialized.includes('Riviera'), false, `${c.action} leaked content into the audit log`);
  }
});

// A missing case previously returned undefined here, which would have thrown on
// the audit write and failed the whole request.
Deno.test('every content action produces an audit summary', () => {
  const reads = [
    { action: 'content.brands.read', input: {} },
    { action: 'content.pillars.list', input: {} },
    { action: 'content.seeds.list', input: {} },
    { action: 'content.research.list', input: {} },
    { action: 'content.library.list', input: {} },
    { action: 'content.voice_exemplars.list', input: {} },
    { action: 'content.schedule.list', input: {} },
    { action: 'content.capture.list_task_events', input: {} },
    { action: 'agent_tasks.next_assigned', input: {} },
  ];
  for (const r of reads) {
    const summary = summarizeGatewayInput(parseGatewayRequest(r));
    assertEquals(typeof summary.inputSummary, 'object', `${r.action} has no audit summary`);
    assertEquals(summary.inputSummary === null, false, `${r.action} has a null audit summary`);
  }
});
