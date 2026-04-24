## Per-list forms + CSV import/export

Add two capabilities to every list (database):

1. **Forms** — generate a fillable form for any list. Each form can be **Public** (shareable link, no login) or **Internal** (workspace members only). Submissions create new rows in the list.
2. **CSV import/export** — bulk export all rows to CSV, and bulk import rows from a CSV file with column mapping.

Both live inside the existing **List Settings** sheet (gear icon, admins only).

---

### 1. Forms

**New table: `database_forms`**
- `id`, `database_id`, `workspace_id`
- `slug` (short unique URL token, e.g. `f_aB3kZ9...`)
- `title`, `description`
- `visibility`: `public` | `internal`
- `fields` (jsonb) — list of `{ column_id, label, required, help_text }` so admins choose which columns appear and in what order
- `submit_message` (thank-you text)
- `is_active`, `created_by`, `created_at`, `updated_at`

RLS:
- Admins manage forms in their workspace.
- Authenticated users can SELECT active forms in their workspace (for internal forms).
- Public forms are fetched/submitted via an edge function with the service role, so no anon RLS needed.

**New edge function: `list-form` (public, no JWT)**
- `GET /list-form/{slug}` → returns form metadata + the list's column types so the renderer can build inputs. 404 if not active or not public.
- `POST /list-form/{slug}` → validates payload against the form fields, inserts a new row into `database_rows`, fires the existing `list-webhook-dispatch` for `row.created`. Returns `{ ok: true }`.

**Internal form submission**: handled client-side via the normal `database_rows` insert (already permitted by RLS for authenticated users). No edge function needed for internal forms.

**UI changes**

- `DatabaseSettingsSheet.tsx` — add a new **Forms** tab between API and Webhooks:
  - List existing forms with status pill (Public / Internal), copy-link button, edit, delete.
  - "New form" button opens an inline editor:
    - Title, description, visibility toggle (Public / Internal)
    - Field picker: checkbox list of the list's columns; for each selected column choose label override + required toggle; drag to reorder
    - Submit message
  - Public forms show a copy-link to `https://<app>/f/{slug}` and the raw edge-function URL.
  - Internal forms show a copy-link to `https://<app>/forms/internal/{slug}`.

- New page `src/pages/PublicFormPage.tsx` (route `/f/:slug`)
  - No auth required. Renders the form by calling `list-form` GET, submits via POST. Shows submit_message on success. Brand-styled, minimal.

- New page `src/pages/InternalFormPage.tsx` (route `/forms/list/:slug`)
  - Auth-required. Fetches form via Supabase client, inserts row directly.

- Add the two routes in `src/App.tsx` (the public one outside the auth gate).

---

### 2. CSV import / export

Pure client-side, no backend changes. Use a tiny CSV helper (≈40 lines of code in `src/lib/csv.ts`) — no new dependency. Quotes/commas/newlines handled.

**UI changes**

- `DatabaseSettingsSheet.tsx` — add an **Import / Export** tab:
  - **Export**: button "Download CSV". Builds CSV from current `database_rows` for this list using the list's column definitions; columns become headers; values stringified by type (dates ISO, multi-select joined with `;`, etc.). File saved as `{list-title}-{YYYY-MM-DD}.csv`.
  - **Import**: file picker (`accept=".csv"`), parses headers, shows a **column mapping** table (CSV column → list column, with auto-match by name and "skip" option). Preview first 3 rows. "Import N rows" button inserts in batches of 100 via `supabase.from("database_rows").insert(...)`. Toast with success/error counts. Each insert fires existing `row.created` webhook dispatch.

- Optional convenience: also surface a small **Export CSV** menu item directly in the list header dropdown next to Settings (not just in Settings) since export is a frequent one-click action.

---

### Permissions summary

| Action | Who |
|---|---|
| Create / edit / delete forms | Admins |
| Submit public form | Anyone with link |
| Submit internal form | Any workspace member |
| Export CSV | Any workspace member (read access already exists) |
| Import CSV | Admins only (matches destructive bulk write pattern) |

---

### Files to create

- `supabase/migrations/<timestamp>_add_database_forms.sql`
- `supabase/functions/list-form/index.ts`
- `src/lib/csv.ts`
- `src/pages/PublicFormPage.tsx`
- `src/pages/InternalFormPage.tsx`
- `src/components/databases/FormsTabPanel.tsx` (extracted for clarity)
- `src/components/databases/ImportExportTabPanel.tsx`

### Files to edit

- `src/components/databases/DatabaseSettingsSheet.tsx` — add Forms + Import/Export tabs
- `src/App.tsx` — register `/f/:slug` (public) and `/forms/list/:slug` (internal) routes
- `src/pages/DatabasesPage.tsx` — optional one-click Export CSV in list header menu
- `supabase/config.toml` — register `list-form` function with `verify_jwt = false`

No changes to existing tables. Existing webhook dispatch is reused so any form/import-created rows trigger outbound webhooks automatically.
