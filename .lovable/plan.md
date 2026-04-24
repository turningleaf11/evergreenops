## Per-list Settings & API Connector

Add a Settings panel to every list (database) so admins can manage the list and connect it to outside systems via REST API and webhooks.

### What you'll see in the app

1. A **Settings** (gear) button in the list header, replacing the bare "Delete Database" link. Admin-only.
2. Clicking it opens a side panel with three tabs:
   - **General** — rename, description, icon, and **Delete list** (with confirm).
   - **API** — a unique REST endpoint URL for this list, an API key (generate / rotate / revoke), and copyable example requests for `GET / POST / PATCH / DELETE` rows. Includes a small reference of the list's columns so external systems know the field IDs.
   - **Webhooks** — 
     - **Inbound:** a unique URL anyone can POST JSON to in order to create a row (with optional shared secret).
     - **Outbound:** add one or more webhook URLs and pick which events fire them (`row.created`, `row.updated`, `row.deleted`). Each webhook shows last delivery status and a "Send test" button. Zapier/Make/n8n style.
3. Recent deliveries log (last 20) per outbound webhook so you can debug failures.

### Permissions
Workspace admins only — matches the rest of the lists module.

---

### Technical plan

**New tables (migration)**
- `database_api_keys` — `id, database_id, workspace_id, key_hash, key_prefix, label, created_by, created_at, revoked_at`. Store only a hash; show full key once on creation.
- `database_webhooks` — `id, database_id, workspace_id, direction ('in'|'out'), url, secret, events text[], active bool, created_by, created_at, last_status, last_delivered_at`. Inbound rows reuse `secret` as the shared signing secret and ignore `url`.
- `database_webhook_deliveries` — `id, webhook_id, event, status_code, response_excerpt, payload jsonb, created_at` (kept to last ~50 per webhook via trim trigger).
- RLS: workspace-scoped read for admins; only admins of the same workspace can insert/update/delete.

**Edge functions**
- `list-api` (public, `verify_jwt = false`): routes `/{database_id}/rows[/:rowId]` for `GET / POST / PATCH / DELETE`. Auth: `Authorization: Bearer <api_key>`; hash and look up in `database_api_keys`, scope all operations to that key's `database_id` + `workspace_id`. Validates body against the list's `columns` schema with Zod.
- `list-webhook-in` (public): `POST /{database_id}` with header `X-Lovable-Signature` (HMAC of body using the inbound webhook's secret). On valid signature, inserts a row.
- `list-webhook-dispatch` (internal, JWT-required): called from the app after row create/update/delete. Looks up active outbound webhooks for the database, POSTs `{ event, database_id, row }` with `X-Lovable-Signature`, records a delivery row, updates `last_status`.

**Frontend**
- New `src/components/databases/DatabaseSettingsSheet.tsx` with the three tabs above (uses existing `Sheet`, `Tabs`, `Input`, `Button`, `Badge`, `ConfirmDeleteDialog`).
- Replace the inline "Delete Database" button in `src/pages/DatabasesPage.tsx` (line ~168) with a `Settings` icon button that opens the sheet; move delete into the General tab.
- After every successful row save / delete in `DatabasesPage.tsx`, fire-and-forget invoke `list-webhook-dispatch` with the event payload.
- Small helper `src/lib/list-api-docs.ts` to render copy-pasteable cURL examples per list.

**Security**
- API keys hashed with SHA-256 before storage; shown plaintext only at creation.
- HMAC-SHA256 signing on inbound and outbound webhook bodies.
- All edge functions include CORS headers and Zod input validation.
- Rate-limit `list-api` and `list-webhook-in` per key/IP via in-memory token bucket (fine for current scale, with a note in code).

**Out of scope (can come later)**
- OpenAPI spec download
- Per-field write permissions on API keys (read-only vs read-write keys)
- Retry queue for failed outbound webhooks (current version logs failure and moves on)
