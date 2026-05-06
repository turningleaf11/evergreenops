# Fix Authentication - Replace Lovable Auth with Supabase Auth

## Problem
The app uses `@lovable.dev/cloud-auth-js` for Google OAuth. This only works on Lovable's platform — deployed app shows 404 on login.

## Solution
Replace Lovable's auth with Supabase's native OAuth.

---

## Files to Update

### 1. LoginPage.tsx
Replace the Google sign-in function.

**Before:**
```typescript
const result = await lovable.auth.signInWithOAuth("google", {
  redirect_uri: `${window.location.origin}/dashboard`,
});
```

**After:**
```typescript
const { error } = await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: `${window.location.origin}/dashboard`,
  },
});
if (error) {
  toast({ title: "Google sign-in failed", description: error.message, variant: "destructive" });
}
```

### 2. SignupPage.tsx
Same change as LoginPage.tsx.

### 3. Remove Lovable imports
- Search for `lovable` imports and remove/replace with Supabase
- Check `src/integrations/lovable/index.ts` usage

---

## Acceptance Criteria
- [ ] Google sign-in works on deployed app
- [ ] Email/password sign-in still works
- [ ] Redirects to /dashboard after login