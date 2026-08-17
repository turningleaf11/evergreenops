import {
  authenticateThroughGateway,
  GatewayUpstreamError,
  parseGatewaySuccess,
  resolveGatewayUrl,
  validateAuthorizationHeader,
} from "./core.ts";

function assert(
  condition: unknown,
  message = "Assertion failed",
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`Expected ${e}, received ${a}`);
}

Deno.test("resolves the existing Agent Gateway endpoint", () => {
  assertEquals(
    resolveGatewayUrl("https://example.supabase.co/"),
    "https://example.supabase.co/functions/v1/agent-gateway",
  );
});

Deno.test("requires a bearer authorization header", () => {
  for (const value of [null, "", "Basic abc", "Bearer ", "Bearer abc def"]) {
    try {
      validateAuthorizationHeader(value);
      throw new Error("Expected authorization to fail");
    } catch (error) {
      assert(error instanceof GatewayUpstreamError);
      assertEquals(error.status, 401);
    }
  }
  assertEquals(
    validateAuthorizationHeader("Bearer opaque-token"),
    "Bearer opaque-token",
  );
});

Deno.test("accepts only a valid system.whoami Gateway response", () => {
  const response = {
    ok: true,
    request_id: "request-id",
    action: "system.whoami",
    data: {
      agent: { id: "agent-id", slug: "ema", name: "Ema" },
      workspace_id: "workspace-id",
    },
  };
  assertEquals(parseGatewaySuccess(response), response);
});

Deno.test("forwards the authorization header without exposing it in the result", async () => {
  const rawToken = "super-secret-test-token";
  let observedAuthorization: string | null = null;
  let observedBody = "";

  const result = await authenticateThroughGateway({
    gatewayUrl: "https://example.test/functions/v1/agent-gateway",
    authorization: `Bearer ${rawToken}`,
    userAgent: "OpenClaw test",
    fetchImpl: async (_input, init) => {
      observedAuthorization = new Headers(init?.headers).get("Authorization");
      observedBody = String(init?.body);
      return new Response(JSON.stringify({
        ok: true,
        request_id: "request-id",
        action: "system.whoami",
        data: {
          agent: { id: "agent-id", slug: "ema", name: "Ema" },
          workspace_id: "workspace-id",
        },
      }));
    },
  });

  assertEquals(observedAuthorization, `Bearer ${rawToken}`);
  assertEquals(JSON.parse(observedBody), {
    action: "system.whoami",
    input: {},
  });
  assert(!JSON.stringify(result).includes(rawToken));
});

Deno.test("relays only sanitized Gateway denial fields", async () => {
  try {
    await authenticateThroughGateway({
      gatewayUrl: "https://example.test/functions/v1/agent-gateway",
      authorization: "Bearer opaque-token",
      userAgent: null,
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            error: "agent_disabled",
            request_id: "request-id",
            internal_detail: "must-not-leak",
          }),
          { status: 403 },
        ),
    });
    throw new Error("Expected Gateway denial");
  } catch (error) {
    assert(error instanceof GatewayUpstreamError);
    assertEquals(error.status, 403);
    assertEquals(JSON.parse(error.body), {
      error: "agent_disabled",
      request_id: "request-id",
    });
    assert(!error.body.includes("must-not-leak"));
  }
});
