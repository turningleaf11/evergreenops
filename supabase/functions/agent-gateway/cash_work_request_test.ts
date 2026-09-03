import {
  ALLOWED_ACTIONS,
  parseGatewayRequest,
  RequestValidationError,
  summarizeGatewayInput,
} from './core.ts';
import { claimNextCashWorkItemJit } from './cash_work_jit.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`Expected ${e}, received ${a}`);
}

Deno.test('Cash work queue is an explicit Gateway action with no caller-controlled routing input', () => {
  assert(ALLOWED_ACTIONS.includes('underwriting.next_work_item'));
  const request = parseGatewayRequest({ action: 'underwriting.next_work_item', input: {} });
  assertEquals(request, { action: 'underwriting.next_work_item', input: {} });
  assertEquals(summarizeGatewayInput(request), {
    inputSummary: { contract: 'cash_work_queue_v1', work_kind: 'sfr_underwriting' },
    resourceType: 'cash_work_queue',
    resourceId: null,
  });
});

Deno.test('Cash work queue rejects caller-supplied pipeline, stage, work kind, or opportunity identity', () => {
  for (const input of [
    { pipeline_id: 'attacker_pipeline' },
    { stage_id: 'attacker_stage' },
    { work_kind: 'portfolio_napkin' },
    { opportunity_id: 'attacker_opportunity' },
  ]) {
    try {
      parseGatewayRequest({ action: 'underwriting.next_work_item', input });
      throw new Error('Expected queue input to be rejected');
    } catch (error) {
      assert(error instanceof RequestValidationError);
    }
  }
});

Deno.test('JIT Cash claim live-validates activation and includes durable candidate source text without Gmail', async () => {
  const candidateId = '6075f34e-686a-49c1-95c8-198899ccd7db';
  const documentId = '8f11a57a-679a-4155-bc84-42fb648f454f';
  const opportunityId = 'opp-1';
  const activationSignalId = 'signal-1';
  let gmailTouched = false;
  const rpcCalls: string[] = [];

  const activeQuery = {
    select() { return this; },
    eq() { return this; },
    order() { return this; },
    async limit() { return { data: [], error: null }; },
  };
  const signalQuery = {
    select() { return this; },
    eq() { return this; },
    order() { return this; },
    async limit() {
      return {
        data: [{
          id: activationSignalId,
          ghl_opportunity_id: opportunityId,
          activated_at: '2026-09-02T17:00:00.000Z',
        }],
        error: null,
      };
    },
  };
  const settingsQuery = {
    select() { return this; },
    async in() {
      return {
        data: [
          { key: 'GHL_API_KEY', value: 'test-ghl-key' },
          { key: 'GHL_LOCATION_ID', value: 'test-location' },
        ],
        error: null,
      };
    },
  };
  const documentQuery = {
    select() { return this; },
    eq() { return this; },
    not() { return this; },
    order() { return this; },
    async limit() {
      return {
        data: [{
          id: documentId,
          ema_candidate_id: candidateId,
          filename: '29910-SW-149th-Ave-Property-Sheet.pdf',
          mime_type: 'application/pdf',
          document_type: 'source_pdf',
          extraction_status: 'succeeded',
          extraction_method: 'unpdf@1.8.0',
          extracted_text: 'Lot Size 7,500 sq ft\nConstruction Block\nNo HOA',
          extracted_text_chars: 48,
          total_pages: 1,
          content_sha256: 'a98f38898d1eeff479bbbaa3431fe043d3bca7a20113f3b1971bcf520a9c3b47',
          source_metadata: {
            source: 'gmail',
            gmail_message_id: '1a005aef0b0b18ca',
            matched_by: 'filename',
            text_is_untrusted_external_content: true,
            secret_should_not_escape: 'nope',
          },
          created_at: '2026-08-26T00:12:28Z',
        }],
        error: null,
        count: 1,
      };
    },
  };

  const admin = {
    async rpc(name: string) {
      rpcCalls.push(name);
      assertEquals(name, 'claim_cash_sfr_activation_signal');
      return {
        data: [{
          work_item_id: 'work-1',
          agent_task_id: 'task-1',
          candidate_id: candidateId,
          ghl_opportunity_id: opportunityId,
          work_kind: 'sfr_underwriting',
          activation_count: 1,
          task_title: 'Underwrite: 29910 SW 149th Ave',
          task_description: 'Cash full SFR underwriting claimed just-in-time after live HighLevel eligibility verification.',
          resumed: false,
          completed_phases: [],
        }],
        error: null,
      };
    },
    from(table: string) {
      if (table.toLowerCase().includes('gmail')) gmailTouched = true;
      if (table === 'cash_work_items') return activeQuery;
      if (table === 'cash_activation_signals') return signalQuery;
      if (table === 'app_settings') return settingsQuery;
      if (table === 'ema_candidate_documents') return documentQuery;
      throw new Error(`Unexpected table: ${table}`);
    },
  };

  const fakeFetch = (async (input: RequestInfo | URL) => {
    assert(String(input).endsWith(`/opportunities/${opportunityId}`));
    return new Response(JSON.stringify({
      opportunity: {
        id: opportunityId,
        name: '29910 SW 149th Ave, Homestead, FL 33033',
        pipelineId: 'w3OtDJjCdN840Hwb1fpt',
        pipelineStageId: '1c3468f6-1a5d-4025-bf20-2bc4bd195708',
        status: 'open',
        customFields: [
          { id: '36WeaPwncmXLzUQhbGHd', fieldValue: 'Single Family Residence' },
          { id: 'hH02pevCKOTpmDYfOTnu', fieldValue: '29910 SW 149th Ave, Homestead, FL 33033' },
        ],
      },
    }), { headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  const result = await claimNextCashWorkItemJit(admin as never, 'workspace-1', fakeFetch);
  assert(result.work_item !== null);
  assertEquals(rpcCalls, ['claim_cash_sfr_activation_signal']);
  assertEquals(gmailTouched, false);
  assertEquals(result.work_item.live_eligibility.eligible, true);
  assertEquals(result.work_item.live_eligibility.status, 'open');
  const source = result.work_item.source_documents as Record<string, unknown>;
  assertEquals(source.status, 'complete');
  assertEquals(source.document_count, 1);
  assertEquals(source.included_document_count, 1);
  assertEquals(source.text_is_untrusted_external_content, true);
  const documents = source.documents as Array<Record<string, unknown>>;
  assertEquals(documents[0].document_id, documentId);
  assertEquals(documents[0].filename, '29910-SW-149th-Ave-Property-Sheet.pdf');
  assertEquals(documents[0].extracted_text, 'Lot Size 7,500 sq ft\nConstruction Block\nNo HOA');
  assertEquals(documents[0].text_truncated, false);
  assertEquals((documents[0].source_metadata as Record<string, unknown>).secret_should_not_escape, undefined);
});
