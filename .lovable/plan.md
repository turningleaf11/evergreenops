# Fix: Gmail send fails with "Edge Function returned non-2xx"

## What's actually wrong

The edge function logs show the real error:

```
ERROR refresh failed { "error": "invalid_grant",
  "error_description": "Token has been expired or revoked." }
```

Your Gmail OAuth refresh token has been revoked by Google (this happens when a Google account password changes, the app is removed from "Apps with access", the token sits unused for 6 months, etc.). The app can't send mail until you reconnect Gmail in **Settings → Integrations → Gmail**.

The bad UX is that the user sees a generic "Edge Function returned a non-2xx status code" toast with no indication of what to do. We'll fix that.

## Changes

### 1. `supabase/functions/_shared/gmail.ts` — return a clear, recognizable error

When `refreshAccessToken` returns null (Google rejected the refresh token), return:
- HTTP **401** (not 500 — this is an auth problem, not a server bug)
- Body: `{ error: "gmail_reauth_required", message: "Your Gmail connection has expired. Please reconnect your Gmail account." }`

### 2. `src/components/inbox/ComposeModal.tsx` — friendly error + reconnect CTA

In the `send()` handler, when the invoke returns an error:
- Try to parse the function's response body. If `error === "gmail_reauth_required"` (or the message mentions reauth/expired), show a **destructive toast** with:
  - Title: "Gmail reconnect required"
  - Description: "Your Gmail connection expired. Reconnect to keep sending."
  - Action button: "Reconnect" → navigates to `/settings/integrations/gmail`
- Otherwise show the existing generic error toast.

Apply the same treatment in `ComposePanel.tsx` (the inbox composer uses the same edge function).

### 3. No DB / no schema changes

The user's existing `gmail_workspace_account` row stays as-is; reconnecting through the existing OAuth flow will overwrite the stored refresh token.

## What the user needs to do after this ships

1. Open **Settings → Integrations → Gmail**
2. Click **Disconnect** (if shown) then **Connect Gmail**
3. Approve the Google OAuth consent screen
4. Try sending the email from the Lead again

The code change makes step 1 obvious; the actual reconnection has to be done by the user since only they can complete Google's OAuth flow.

## Files touched

- `supabase/functions/_shared/gmail.ts` (1 small return change + redeploy)
- `src/components/inbox/ComposeModal.tsx` (error parsing + reconnect toast)
- `src/components/inbox/ComposePanel.tsx` (same)

Edge function `gmail-send` will be redeployed automatically since it imports the shared helper.
