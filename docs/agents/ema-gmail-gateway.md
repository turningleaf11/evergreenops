# Ema Gmail Gateway

`ema-gmail-gateway` gives the Ema OpenClaw agent narrowly scoped, read-only
access to the office Gmail account through EvergreenOps. Google OAuth client
credentials and refresh tokens remain inside the existing Supabase Gmail
integration and are never returned to Ema.

## Configuration

Configure these Supabase Edge Function secrets:

- `EMA_GMAIL_GATEWAY_SECRET`: a dedicated, randomly generated bearer secret.
- `EMA_GMAIL_ACCOUNT`: `office@evergreenhomegroup.com` (optional; this is
  also the hard-coded default and only permitted mailbox).
- Existing Gmail integration secrets: `GOOGLE_OAUTH_CLIENT_ID` and
  `GOOGLE_OAUTH_CLIENT_SECRET`.

OpenClaw receives only:

- `EMA_GMAIL_GATEWAY_URL`
- `EMA_GMAIL_GATEWAY_SECRET`

The gateway URL will be:

```text
https://dsxrekabnwvarnroanny.supabase.co/functions/v1/ema-gmail-gateway
```

## Request contract

All requests use `POST`, JSON, and:

```text
Authorization: Bearer <EMA_GMAIL_GATEWAY_SECRET>
```

List up to 50 Inbox messages:

```json
{
  "action": "list_messages",
  "after_epoch_seconds": 1786741200,
  "page_token": "optional Gmail page token"
}
```

Retrieve a complete thread with bodies and attachment descriptors:

```json
{
  "action": "get_thread",
  "thread_id": "Gmail thread ID"
}
```

Retrieve attachment bytes as URL-safe base64 (maximum 25 MB):

```json
{
  "action": "get_attachment",
  "message_id": "Gmail message ID",
  "attachment_id": "Gmail attachment ID"
}
```

Every response includes `request_id` and `account`. Errors contain only a
safe message and never include Gmail response bodies or credentials.

## Security boundary

The function has no actions for sending, drafting, modifying labels, changing
read state, archiving, or deleting. Its mailbox is hard-bound to
`office@evergreenhomegroup.com`. Requests and outcomes are written to Edge
Function logs without message content, Gmail identifiers, or credentials.

`verify_jwt` is disabled because this is a server-to-server endpoint using its
own dedicated bearer secret. The function performs its own constant-time secret
comparison before looking up the Gmail account or refreshing its token.

## Deployment

Deployment and secret configuration are intentionally deferred until review.
Before deployment, confirm the office Gmail account exists as an active row in
`gmail_workspace_account`, configure the Ema gateway secret in Supabase and
OpenClaw, and test unauthorized access before any mailbox read.
