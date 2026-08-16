# Supabase Agent Gateway

The Agent Gateway is the security boundary between autonomous OpenClaw agents
and Evergreen's business systems. Agents request named capabilities; they never
receive Supabase service-role credentials, Google refresh tokens, GHL tokens, or
generic database access.

## Milestone 1 scope

This milestone establishes an authenticated, read-only Ema-to-Gmail path.

Enabled for Ema:

- `system.whoami`
- `email.list`
- `email.search`
- `email.read`
- `email.get_attachment`

Not enabled:

- Gmail draft creation, labels, mark-read, or sending
- Any GHL/CRM mutation
- Underwriting persistence
- Approval execution
- Generic SQL, HTTP, or table access
- Credentials or permissions for future agents

Albus is the canonical orchestrator name. Thor is a retired alias for Albus and
must not be provisioned as a separate Gateway identity.

## Request contract

The Gateway accepts only `POST application/json` requests:

```json
{
  "action": "email.search",
  "input": {
    "query": "to:deals@evergreenhomegroup.com newer_than:7d",
    "max_results": 25
  }
}
```

Authentication uses a unique opaque bearer credential for the calling agent.
The raw credential is never stored in Postgres. OpenClaw/HeyRon must inject it
into the Authorization header outside the model-visible tool arguments.

The model-visible tool contract must contain only `action` and `input`.
Ema must never be asked to read, remember, print, or interpolate the credential.

## Authentication and authorization

1. Hash the presented bearer credential with SHA-256.
2. Find the matching active `agent_api_credentials` row.
3. Resolve the associated agent and workspace.
4. Enforce `agents.enabled` as the emergency kill switch.
5. Require an enabled exact match in `agent_permissions`.
6. Atomically consume that action's fixed-window rate limit.
7. Record the authorized request before contacting Gmail.
8. Execute the narrow adapter and append a sanitized security audit event.

SHA-256 is appropriate here because credentials must be independently generated
with at least 256 bits of entropy. It is not appropriate for user passwords.

## Secret handling

The raw agent credential must be generated and installed by a trusted operator,
not by an autonomous agent or in chat.

Required storage:

- Supabase stores only `token_hash` and a non-secret display prefix.
- HeyRon/OpenClaw stores the raw credential in protected integration storage.
- The tool binding injects the Authorization header.
- Agent prompts, skills, workspace files, logs, and task payloads contain no raw
  credential.

The current Gmail OAuth connection is reused. Google client credentials remain
Edge Function Secrets and the Gmail refresh token remains server-side. Moving
renewable OAuth credentials into Vault is a later hardening milestone.

## Gmail boundary

The Gateway is limited to the workspace credential's configured office mailbox.
The default account is `office@evergreenhomegroup.com`; operators may override
it server-side with `AGENT_GATEWAY_GMAIL_ACCOUNT`.

Aliases delivered into that mailbox, including deal-address aliases, remain
visible because Gmail reads the underlying connected mailbox.

Gmail responses are explicitly marked:

```json
{
  "untrusted_external_content": true
}
```

Email bodies, attachments, and headers are untrusted data. Their contents never
change Gateway permissions or count as owner approval.

## Audit privacy

The audit trail records agent, action, resource identifier, result, duration,
source, and error metadata. It deliberately excludes:

- Authorization headers or token hashes
- Google access or refresh tokens
- Email bodies and attachment contents
- Gmail search-query text
- Raw upstream error bodies

Search audit entries store only query length and pagination metadata.

## Rollout sequence

1. Merge the migration and function code.
2. Apply the migration.
3. Deploy `agent-gateway` with custom authentication
   (`verify_jwt = false` is intentional).
4. Generate one Ema credential outside model-visible systems.
5. Store only its hash and prefix in `agent_api_credentials`.
6. Bind the raw value as a protected HeyRon/OpenClaw request header.
7. Run the acceptance tests below.
8. Keep `ema-gmail-gateway` available during validation.
9. Retire the old shared-secret Gateway only after the new path is proven.

## Acceptance tests

Before enabling Ema's heartbeat:

- Missing credential returns 401.
- Random credential returns 401.
- Revoked credential returns 401 and creates a denial audit event.
- Expired credential returns 401 and creates a denial audit event.
- `agents.enabled = false` returns 403.
- An action without permission returns 403.
- An unsupported/generic action such as `http.request` returns 400.
- Rate-limit overflow returns 429.
- `system.whoami` resolves Ema and the correct workspace.
- Gmail list, search, thread read, and attachment retrieval work read-only.
- Every authenticated attempt has a sanitized database audit event.
- No raw credential appears in logs, responses, prompts, or OpenClaw workspace
  files.
- No Gmail mutation, CRM mutation, Cash task, or Zapier call occurs.

## Future agents

The schema supports Albus, Cash, Claude, Dex, Piper, Tracie, Marquetta, and Raya.
They receive no Gateway credential or permission until their role and tool
contract are defined.
