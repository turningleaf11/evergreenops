

# Fix User Invitation to Actually Send Emails

## Problem
The `invite-user` edge function creates the user with `createUser` + `email_confirm: true`, then calls `generateLink` which only returns a link object — it doesn't send an email. The invited user never receives anything.

## Fix
Replace the current `createUser` + `generateLink` approach with `inviteUserByEmail`, which is the built-in method that:
- Creates the user account
- Sends them an invitation email with a link to set their password
- Handles everything in one call

## Changes

| File | Change |
|------|--------|
| `supabase/functions/invite-user/index.ts` | Replace `createUser` + `generateLink` with `inviteUserByEmail`. After the invite, update profile with department/name and add admin role if needed. |
| Deploy | Redeploy the `invite-user` edge function |

## Technical detail

```typescript
// Replace createUser + generateLink with:
const { data: inviteData, error: inviteError } = 
  await adminClient.auth.admin.inviteUserByEmail(email.trim(), {
    data: { full_name: full_name || "" },
  });
```

The `handle_new_user` trigger already creates the profile and default `user` role when the auth user is created, so after invite we just need to update department and optionally add admin role.

