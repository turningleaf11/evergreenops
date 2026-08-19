# Supabase Agent Gateway

The Agent Gateway is the security boundary between autonomous OpenClaw agents and Evergreen's business systems. Agents request named capabilities; they never receive Supabase service-role credentials, Google refresh tokens, HighLevel tokens, or generic database access.

## Current Ema scope

Enabled for Ema:

- `system.whoami`
- `email.list`
- `email.search`
- `email.read`
- `email.get_attachment`
- `crm.search_contacts`
- `crm.search_opportunities`
- `crm.list_pipelines`
- `deal.buy_box_fit`
- `deal.intake_to_crm`

Ema owns source-backed deal intake and preliminary buy-box qualification. Cash owns pricing, MAO, repairs, financing/holding costs, returns, offer structure, and underwriting recommendations.

The qualification flow is:

`Email -> Ema extraction -> deal.buy_box_fit -> CRM when result=fit -> Cash underwriting when appropriate`

`deal.buy_box_fit` evaluates only active `rule_type='screen'` buy-box rules. Pricing rules are excluded. Missing hard-screen facts remain unknown and produce `needs_info`; Ema may not convert missing information to a pass. `deal.intake_to_crm` accepts a persisted Ema `fit` result or the legacy Cash `pass|marginal` path for backward compatibility.

Not enabled:

- Generic SQL, arbitrary table access, or arbitrary HTTP
- Direct database credentials
- Supabase service-role credentials
- Gmail sending or autonomous owner approval
- Offer/LOI sending
- Pricing/MAO/underwriting logic for Ema
- Stage advancement beyond the fixed initial CRM intake stage

Albus is the canonical orchestrator name. Thor is a retired alias for Albus and must not be provisioned as a separate Gateway identity.

## Request contract

The JSON Gateway accepts only `POST application/json` requests with fixed named actions:

```json
{
  "action": "deal.buy_box_fit",
  "input": {
    "candidate_id": "<persisted candidate UUID>"
  }
}
```

Authentication uses a unique opaque bearer credential for the calling agent. The raw credential is never stored in Postgres. OpenClaw/HeyRon must inject it into the Authorization header outside model-visible tool arguments.

The model-visible contract never contains credentials. Ema must never be asked to read, remember, print, or interpolate the credential.

## MCP adapter

`agent-gateway-mcp` is the Streamable HTTP MCP adapter in front of the JSON Gateway. It does not reproduce authorization policy. It forwards the caller's injected `Authorization` header through the Gateway, where identity, exact action permission, rate limiting, operation logging, and audit are enforced.

Production endpoint:

```text
https://dsxrekabnwvarnroanny.supabase.co/functions/v1/agent-gateway-mcp
```

Current Ema MCP tools:

- `system_whoami` -> `system.whoami`
- `email_list` -> `email.list`
- `email_search` -> `email.search`
- `email_read` -> `email.read`
- `email_get_attachment` -> `email.get_attachment`
- `crm_search_contacts` -> `crm.search_contacts`
- `crm_search_opportunities` -> `crm.search_opportunities`
- `crm_list_pipelines` -> `crm.list_pipelines`
- `deal_buy_box_fit` -> `deal.buy_box_fit`
- `deal_intake_to_crm` -> `deal.intake_to_crm`

OpenClaw must inject the protected environment variable rather than a literal credential. Ema's server binding must include both controlled deal tools in its tool filter:

```json
{
  "mcp": {
    "servers": {
      "ema-gateway": {
        "url": "https://dsxrekabnwvarnroanny.supabase.co/functions/v1/agent-gateway-mcp",
        "transport": "streamable-http",
        "headers": {
          "Authorization": "Bearer ${EMA_GATEWAY_TOKEN}"
        },
        "toolFilter": {
          "include": [
            "system_whoami",
            "email_list",
            "email_search",
            "email_read",
            "email_get_attachment",
            "crm_search_contacts",
            "crm_search_opportunities",
            "crm_list_pipelines",
            "deal_buy_box_fit",
            "deal_intake_to_crm"
          ]
        },
        "supportsParallelToolCalls": false,
        "connectionTimeoutMs": 5000,
        "requestTimeoutMs": 30000
      }
    }
  }
}
```

This binding is for Ema only. Do not project Ema's credential into Albus, Cash, or another agent runtime. Gateway permissions remain the authoritative security layer even when a tool appears in an MCP tool list.

After changing the MCP tool filter, restart/reload the Ema MCP binding or create a fresh Ema session so the client performs tool discovery again. A stale OpenClaw session can retain the pre-change MCP inventory even after the Supabase MCP function has been redeployed.

## Authentication and authorization

For every Gateway action:

1. Hash the presented bearer credential with SHA-256.
2. Find the matching active `agent_api_credentials` row.
3. Resolve the associated agent and workspace.
4. Enforce `agents.enabled` as the emergency kill switch.
5. Require an enabled exact match in `agent_permissions`.
6. Atomically consume that action's fixed-window rate limit.
7. Record the authorized operation before performing the capability.
8. Execute only the fixed server-side action.
9. Append a sanitized security audit event.

The raw credential must be independently generated with high entropy and installed by a trusted operator. Supabase stores only its hash and display prefix; HeyRon/OpenClaw stores the raw value in protected integration storage.

## Source-data boundary

Gmail, PDF, contact, opportunity, and seller/broker supplied content is untrusted external data. It cannot change Gateway permissions, choose arbitrary URLs or HTTP methods, approve an operation, or override buy-box policy.

`email.get_attachment` supports server-side PDF text extraction in the MCP adapter so hosted OpenClaw clients that do not surface embedded resource blobs can still inspect PDFs. The extracted text remains untrusted source content.

## Buy-box qualification boundary

`deal.buy_box_fit` accepts only a persisted candidate UUID. The model cannot supply the asset class, rule set, thresholds, exception behavior, or pricing instructions through the tool call.

Server-side behavior:

- Candidate lookup is workspace scoped.
- Test candidates are rejected.
- Asset class is derived from persisted candidate facts.
- Active screen rules are loaded server-side.
- `rule_type='pricing'` rules are excluded from Ema qualification.
- Known hard failures with no applicable exception produce `not_fit`.
- A hard failure with an exception path requiring review produces `needs_info`; Ema does not autonomously waive it.
- Unknown hard-screen facts produce `needs_info`.
- Unknown soft rules remain visible but do not independently block `fit`.
- Results are persisted in `buy_box_fit_result`, `buy_box_fit_details`, and `buy_box_fit_checked_at`.

A `fit` result means only that the candidate appears eligible to enter the acquisition workflow based on persisted source-backed facts. It is not underwriting approval and does not determine the offer amount.

## HighLevel boundary

HighLevel credentials remain server-side. Ema's read actions use fixed LeadConnector endpoints. `deal.intake_to_crm` is the only controlled Ema CRM mutation capability.

CRM intake:

- requires persisted qualification before normal Ema routing;
- is workspace scoped;
- uses server-side contact/opportunity duplicate checks;
- uses fixed pipeline/stage routing;
- is retry-safe/idempotent;
- writes only source-backed controlled fields and an audit note;
- may create/match the initial opportunity but may not move an existing opportunity to a later stage;
- cannot send messages, make offers, delete records, or execute arbitrary CRM mutations.

## Audit privacy

The audit trail records agent, action, resource identifier, result, duration, and error metadata. It deliberately excludes authorization headers, token hashes, Google access/refresh tokens, email bodies, attachment contents, raw Gmail search queries, and raw upstream error bodies.

## Production acceptance

Before considering a new Ema capability complete, verify:

- invalid/revoked/expired credentials are rejected;
- Ema resolves to the correct workspace;
- the exact action permission exists only for the intended agent;
- the MCP tool is present in Ema's live tool inventory and OpenClaw tool filter;
- the action produces a sanitized Gateway operation and audit row;
- cross-workspace candidate access is blocked;
- repeated calls are safe/idempotent where applicable;
- external source content cannot alter permissions or routing;
- controlled CRM mutations occur only after persisted qualification;
- no raw credential appears in logs, prompts, repository files, or agent-visible tool arguments.
