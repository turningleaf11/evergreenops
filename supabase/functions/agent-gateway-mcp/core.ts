export const MCP_SERVER_NAME = "evergreen-agent-gateway";
export const MCP_SERVER_VERSION = "0.1.0";
export const WHOAMI_TOOL_NAME = "system_whoami";

export interface GatewayWhoAmI {
  agent: {
    id: string;
    slug: string;
    name: string;
  };
  workspace_id: string;
}

export interface GatewaySuccess {
  ok: true;
  request_id: string;
  action: "system.whoami";
  data: GatewayWhoAmI;
}

export class GatewayUpstreamError extends Error {
  constructor(
    public status: number,
    public body: string,
    public retryAfter: string | null = null,
  ) {
    super(`Agent Gateway returned HTTP ${status}`);
    this.name = "GatewayUpstreamError";
  }
}

export function resolveGatewayUrl(supabaseUrl: string): string {
  const normalized = supabaseUrl.trim().replace(/\/+$/, "");
  if (!normalized.startsWith("https://") && !normalized.startsWith("http://")) {
    throw new Error("Invalid SUPABASE_URL");
  }
  return `${normalized}/functions/v1/agent-gateway`;
}

export function validateAuthorizationHeader(value: string | null): string {
  if (!value || !/^Bearer\s+\S+$/i.test(value)) {
    throw new GatewayUpstreamError(
      401,
      JSON.stringify({ error: "invalid_credentials" }),
    );
  }
  return value;
}

export function parseGatewaySuccess(value: unknown): GatewaySuccess {
  if (
    !isRecord(value) || value.ok !== true || value.action !== "system.whoami"
  ) {
    throw new Error("Invalid Agent Gateway response");
  }
  if (typeof value.request_id !== "string" || !isWhoAmI(value.data)) {
    throw new Error("Invalid Agent Gateway response");
  }
  return value as unknown as GatewaySuccess;
}

export async function authenticateThroughGateway(params: {
  gatewayUrl: string;
  authorization: string | null;
  userAgent: string | null;
  fetchImpl?: typeof fetch;
}): Promise<GatewaySuccess> {
  const authorization = validateAuthorizationHeader(params.authorization);
  const fetchImpl = params.fetchImpl ?? fetch;
  const headers = new Headers({
    Authorization: authorization,
    "Content-Type": "application/json",
  });
  if (params.userAgent) {
    headers.set("User-Agent", params.userAgent.slice(0, 512));
  }

  const response = await fetchImpl(params.gatewayUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "system.whoami", input: {} }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.text();

  if (!response.ok) {
    throw new GatewayUpstreamError(
      response.status,
      sanitizeErrorBody(body),
      response.headers.get("Retry-After"),
    );
  }

  try {
    return parseGatewaySuccess(JSON.parse(body));
  } catch {
    throw new GatewayUpstreamError(
      502,
      JSON.stringify({ error: "invalid_gateway_response" }),
    );
  }
}

function sanitizeErrorBody(body: string): string {
  try {
    const parsed = JSON.parse(body);
    if (isRecord(parsed) && typeof parsed.error === "string") {
      const safe: Record<string, unknown> = { error: parsed.error };
      if (typeof parsed.request_id === "string") {
        safe.request_id = parsed.request_id;
      }
      if (typeof parsed.retry_after_seconds === "number") {
        safe.retry_after_seconds = parsed.retry_after_seconds;
      }
      return JSON.stringify(safe);
    }
  } catch {
    // Return a fixed error below; never relay arbitrary upstream content.
  }
  return JSON.stringify({ error: "agent_gateway_request_failed" });
}

function isWhoAmI(value: unknown): value is GatewayWhoAmI {
  if (!isRecord(value) || typeof value.workspace_id !== "string") return false;
  if (!isRecord(value.agent)) return false;
  return typeof value.agent.id === "string" &&
    typeof value.agent.slug === "string" &&
    typeof value.agent.name === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
