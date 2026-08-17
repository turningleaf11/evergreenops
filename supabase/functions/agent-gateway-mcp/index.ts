import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { McpServer } from "npm:@modelcontextprotocol/sdk@1.25.3/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "npm:@modelcontextprotocol/sdk@1.25.3/server/webStandardStreamableHttp.js";

import {
  authenticateThroughGateway,
  GatewayUpstreamError,
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  resolveGatewayUrl,
  WHOAMI_TOOL_NAME,
} from "./core.ts";

const MAX_REQUEST_BYTES = 64 * 1024;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Allow: "POST",
      },
    });
  }

  const declaredLength = Number(req.headers.get("Content-Length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return jsonError("request_too_large", 413);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) return jsonError("adapter_not_configured", 500);

  try {
    // This is deliberately the only authentication/policy call. The existing
    // Agent Gateway validates the bearer credential, kill switch, exact
    // permission, rate limit, operation state, and audit record. The MCP
    // adapter neither stores nor interprets the raw credential.
    const gateway = await authenticateThroughGateway({
      gatewayUrl: resolveGatewayUrl(supabaseUrl),
      authorization: req.headers.get("Authorization"),
      userAgent: req.headers.get("User-Agent"),
    });

    const server = new McpServer({
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
    });

    server.registerTool(
      WHOAMI_TOOL_NAME,
      {
        title: "Identify the authenticated Evergreen agent",
        description:
          "Returns the agent and workspace resolved by the existing Agent Gateway security core.",
        inputSchema: {},
      },
      () => ({
        content: [{ type: "text", text: JSON.stringify(gateway.data) }],
        structuredContent: {
          agent: gateway.data.agent,
          workspace_id: gateway.data.workspace_id,
        },
      }),
    );

    const transport = new WebStandardStreamableHTTPServerTransport();
    await server.connect(transport);
    return await transport.handleRequest(req);
  } catch (error) {
    if (error instanceof GatewayUpstreamError) {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      };
      if (error.status === 401) headers["WWW-Authenticate"] = "Bearer";
      if (error.retryAfter) headers["Retry-After"] = error.retryAfter;
      return new Response(error.body, { status: error.status, headers });
    }

    if (error instanceof DOMException && error.name === "TimeoutError") {
      return jsonError("agent_gateway_timeout", 504);
    }

    console.error(JSON.stringify({
      event: "agent_gateway_mcp_error",
      error_type: error instanceof Error ? error.name : typeof error,
    }));
    return jsonError("internal_adapter_error", 500);
  }
});

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
