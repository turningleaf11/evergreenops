import { useWorkspace } from "@/contexts/WorkspaceContext";

/**
 * Hardcoded workspace allowed to access the Developer page.
 * Mirrors the backend `is_developer_workspace_admin()` SQL helper.
 *
 * Currently: Evergreen HQ.
 */
export const DEVELOPER_WORKSPACE_ID = "2a918558-69fa-4d12-9b2d-fe59e0823997";

/**
 * Email used for "Contact support" links across the app.
 * Single source of truth — update here and the help center + sidebar pick it up.
 */
export const SUPPORT_EMAIL = "support@orrahq.com";

/**
 * Returns true when the active workspace is the developer-gated workspace.
 * Combine with `isPrimaryAdmin` from `useAuth` to gate Developer features.
 */
export function useIsDeveloperWorkspace(): boolean {
  const { id } = useWorkspace();
  return id === DEVELOPER_WORKSPACE_ID;
}
