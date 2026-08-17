import {
  DEFAULT_INLINE_ATTACHMENT_BYTES,
  isUntrustedExternalAction,
  MAX_INLINE_ATTACHMENT_BYTES,
  parseBearerToken,
  parseGatewayRequest,
  RequestValidationError,
  summarizeGatewayInput,
} from './core.ts';

function assert(
  condition: unknown,
  message = 'Assertion failed',
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`Expected ${e}, received ${a}`);
}

function assertThrows(
  fn: () => unknown,
  errorType: typeof RequestValidationError,
): void {
  try {
    fn();
  } catch (error) {
    assert(error instanceof errorType, 'Unexpected error type');
    return;
  }
  throw new Error('Expected function to throw');
}

Deno.test('accepts a sufficiently long opaque bearer token', () => {
  const token = 'a'.repeat(64);
  assertEquals(parseBearerToken(`Bearer ${token}`), token);
});

Deno.test('rejects missing, short, or whitespace-containing bearer tokens', () => {
  assertEquals(parseBearerToken(null), null);
  assertEquals(parseBearerToken('Bearer short'), null);
  assertEquals(parseBearerToken(`Bearer ${'a'.repeat(40)} extra`), null);
});

Deno.test('normalizes email.list defaults', () => {
  assertEquals(parseGatewayRequest({ action: 'email.list' }), {
    action: 'email.list',
    input: {
      max_results: 50,
      page_token: null,
      after_epoch_seconds: null,
    },
  });
});

Deno.test('validates and normalizes email.search', () => {
  assertEquals(
    parseGatewayRequest({
      action: 'email.search',
      input: { query: 'from:broker@example.com', max_results: 10 },
    }),
    {
      action: 'email.search',
      input: {
        query: 'from:broker@example.com',
        max_results: 10,
        page_token: null,
      },
    },
  );
});

Deno.test('rejects unsupported actions and invalid Gmail identifiers', () => {
  assertThrows(
    () => parseGatewayRequest({ action: 'http.request', input: {} }),
    RequestValidationError,
  );
  assertThrows(
    () =>
      parseGatewayRequest({
        action: 'email.read',
        input: { thread_id: '../secret' },
      }),
    RequestValidationError,
  );
});

Deno.test('audit summary never contains the Gmail search query', () => {
  const request = parseGatewayRequest({
    action: 'email.search',
    input: { query: 'confidential seller terms' },
  });
  const summary = summarizeGatewayInput(request);
  assertEquals(summary.inputSummary, {
    query_length: 25,
    max_results: 50,
    has_page_token: false,
  });
  assert(!JSON.stringify(summary).includes('confidential seller terms'));
});

Deno.test('attachment requests apply bounded inline limits', () => {
  const request = parseGatewayRequest({
    action: 'email.get_attachment',
    input: {
      message_id: 'message_123',
      attachment_id: 'attachment_456',
    },
  });
  assertEquals(request.input, {
    message_id: 'message_123',
    attachment_id: 'attachment_456',
    max_bytes: DEFAULT_INLINE_ATTACHMENT_BYTES,
  });
  assertEquals(
    parseGatewayRequest({
      action: 'email.get_attachment',
      input: {
        message_id: 'message_123',
        attachment_id: 'attachment_456',
        max_bytes: MAX_INLINE_ATTACHMENT_BYTES,
      },
    }).input.max_bytes,
    MAX_INLINE_ATTACHMENT_BYTES,
  );
  assertThrows(
    () =>
      parseGatewayRequest({
        action: 'email.get_attachment',
        input: {
          message_id: 'message_123',
          attachment_id: 'attachment_456',
          max_bytes: MAX_INLINE_ATTACHMENT_BYTES + 1,
        },
      }),
    RequestValidationError,
  );
});

Deno.test('normalizes the three read-only CRM actions', () => {
  assertEquals(
    parseGatewayRequest({
      action: 'crm.search_contacts',
      input: { query: 'broker@example.com' },
    }),
    {
      action: 'crm.search_contacts',
      input: { query: 'broker@example.com', limit: 20, page: 1 },
    },
  );
  assertEquals(
    parseGatewayRequest({
      action: 'crm.search_opportunities',
      input: {
        query: '123 Main St',
        contact_id: 'contact_123',
        pipeline_id: 'pipeline_123',
        stage_id: 'stage_123',
        status: 'open',
      },
    }),
    {
      action: 'crm.search_opportunities',
      input: {
        query: '123 Main St',
        contact_id: 'contact_123',
        pipeline_id: 'pipeline_123',
        stage_id: 'stage_123',
        status: 'open',
        limit: 20,
        page: 1,
      },
    },
  );
  assertEquals(parseGatewayRequest({ action: 'crm.list_pipelines' }), {
    action: 'crm.list_pipelines',
    input: {},
  });
});

Deno.test('rejects broad or malformed CRM requests', () => {
  assertThrows(
    () =>
      parseGatewayRequest({
        action: 'crm.search_opportunities',
        input: {},
      }),
    RequestValidationError,
  );
  assertThrows(
    () =>
      parseGatewayRequest({
        action: 'crm.search_opportunities',
        input: { query: '123 Main', status: 'deleted' },
      }),
    RequestValidationError,
  );
  assertThrows(
    () =>
      parseGatewayRequest({
        action: 'crm.update_opportunity',
        input: {},
      }),
    RequestValidationError,
  );
});

Deno.test('CRM audit summaries omit search terms and external data stays untrusted', () => {
  const request = parseGatewayRequest({
    action: 'crm.search_opportunities',
    input: { query: 'confidential property address' },
  });
  const summary = summarizeGatewayInput(request);
  assert(summary.inputSummary.query_length === 29);
  assert(!JSON.stringify(summary).includes('confidential property address'));
  assert(isUntrustedExternalAction('email.read'));
  assert(isUntrustedExternalAction('crm.search_contacts'));
  assert(!isUntrustedExternalAction('system.whoami'));
});
