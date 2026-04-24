## Fix primary-admin Vision Setup redirect

This is not happening because you already have an account. The current code shows that the button is only visible to a primary admin, so your account is already being recognized correctly in Settings.

The redirect is happening because the app reloads into `/onboarding`, then briefly checks `isPrimaryAdmin` before the role query has finished. In that short window, the page treats you like a non-admin and sends you back to `/`.

### Changes to make

1. Update `src/contexts/AuthContext.tsx`
- Add a dedicated `roleLoaded` flag.
- Reset it whenever auth state changes or the user signs out.
- Only mark `roleLoaded = true` after both the `profiles` query and the `user_roles` query complete.
- Expose `roleLoaded` from `useAuth()`.

2. Update `src/pages/OnboardingPage.tsx`
- Do not evaluate the non-admin redirect until `roleLoaded` is true.
- Keep the loading state visible while auth or role resolution is still in flight.
- Preserve the current onboarding experience once role data is ready.

3. Update `src/components/OnboardingGate.tsx`
- Wait for `roleLoaded` before deciding whether the user is a primary admin.
- Prevent the gate from making an early false “not primary admin” decision during refresh/navigation.

4. Update `src/App.tsx`
- Make `PrimaryAdminRoute` wait for role resolution too, so all primary-admin-only routes use the same readiness rule.

5. Update `src/pages/SettingsPage.tsx`
- Replace `window.location.href = "/onboarding"` with router navigation.
- After resetting onboarding fields and refreshing the profile, navigate with SPA routing so the auth tree stays mounted and the race window is minimized.

### Expected result

After this change:
- A primary admin can click `Run Vision Setup` from Settings.
- The app will stay on `/onboarding` instead of bouncing to `/`.
- Existing accounts will be able to re-run Vision Setup normally.

### Technical details

Relevant code already confirms the race:
- `SettingsPage.tsx` uses a hard reload: `window.location.href = "/onboarding"`
- `OnboardingPage.tsx` redirects when `profile && !isPrimaryAdmin`
- `AuthContext.tsx` sets `loading = false` before role resolution is guaranteed complete
- `OnboardingGate.tsx` also evaluates `isPrimaryAdmin` without a separate role-ready state

Approve this plan and I’ll implement the guard synchronization fix across those files.