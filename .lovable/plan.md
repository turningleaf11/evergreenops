I checked the live request and database policies. This is not because AI Workshop is an add-on. The add-on gate only controls whether the page appears in navigation. The failure is still a database permission/RLS issue.

What I found:
- The Create request is authenticated and includes the correct user ID and workspace ID.
- The user's profile exists and matches the workspace being inserted.
- The `ai_projects` insert policy exists, but it is still failing.
- The database trigger intended to fill defaults exists in the actual database, although the provided environment summary incorrectly said there were no triggers.
- The likely problem is the current insert policy is too dependent on `get_user_workspace_id()` and profile state during the insert, and the code also immediately requests the inserted row back with `.select("id").single()`, which means SELECT RLS also has to pass as part of creation.

Plan to fix:

1. Simplify AI project creation in the frontend
   - Update `NewAiProjectDialog` so the insert only sends user-entered project fields: `name`, `stage`, and `live_url`.
   - Stop sending `workspace_id`, `owner_id`, and `created_by` from the browser.
   - Let the database trigger set those ownership/workspace fields server-side.
   - Avoid `.single()` on project creation where possible, or make the returned selection safe after insert.

2. Harden the database defaults
   - Update the `ai_projects_set_defaults()` trigger function so it always derives `workspace_id`, `created_by`, and `owner_id` safely from the authenticated user.
   - Make sure it raises a clear error if a signed-in user has no workspace/profile, instead of surfacing as a generic RLS failure.

3. Replace the fragile INSERT policy
   - Replace the current `ai_projects` INSERT policy with a safer authenticated-user policy that allows creating rows when the final row belongs to the authenticated user's workspace and creator.
   - Because `workspace_id` and `created_by` are set server-side before the policy check, the policy can validate the final row cleanly.
   - Keep SELECT/UPDATE/DELETE restrictions intact so users only see/edit projects they are allowed to access.

4. Make project access checks robust
   - Review `can_access_ai_project` and `can_edit_ai_project` for cross-workspace safety.
   - Ensure `can_edit_ai_project` also confirms the project is in the user's workspace before checking ownership/collaborator/admin status.
   - This avoids any accidental cross-workspace access later.

5. Add a better UI error path
   - If project creation still fails, show a more helpful message such as “Your account is missing workspace access” when applicable.
   - Keep the current destructive toast for true permission errors.

6. Verify after changes
   - Re-test creating “Albus” from `/ai-workshop`.
   - Confirm the project appears on the board/list and opens in the project peek sheet.
   - Confirm this remains gated by the AI Workshop add-on in the sidebar, while database access remains controlled by workspace/auth permissions.