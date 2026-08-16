import {
  parseBearerToken,
  parseGatewayRequest,
  RequestValidationError,
  summarizeGatewayInput,
} from './core.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`Expected ${e}, received ${a}`);
}

function assertThrows(\n  fn: () => unknown,\n  errorType: typeof RequestValidationError,\n): void {
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
  assertEquals(parseGatewayRequest({
    action: 'email.search',
    input: { query: 'from:broker@example.com', max_results: 10 },
  }), {
    action: 'email.search',
    input: {
      query: 'from:broker@example.com',
      max_results: 10,
      page_token: null,
    },
  });
});

Deno.test('rejects unsupported actions and invalid Gmail identifiers', () => {
  assertThrows(
    () => parseGatewayRequest({ action: 'http.request', input: {} }),
    RequestValidationError,
  );
  assertThrows(
    () => parseGatewayRequest({
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

Deno.test('attachment requests retain only identifiers needed for routing', () => {
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
  });
});
