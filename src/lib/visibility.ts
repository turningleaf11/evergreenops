export interface SharedWith {
  departmentIds: string[];
  memberIds: string[];
}

export interface VisibilityScoped {
  visibility: string;
  sharedWith: SharedWith | null | undefined;
  authorId?: string | null;
}

export interface ViewerContext {
  isAdmin: boolean;
  userId?: string | null;
  departmentId?: string | null;
}

/**
 * Same visibility rule used across documents/business plans: "workspace" is
 * open to everyone, "private" is author-only, anything else checks
 * sharedWith.departmentIds / memberIds against the viewer. Admins bypass.
 */
export function matchesVisibility(item: VisibilityScoped, viewer: ViewerContext): boolean {
  if (viewer.isAdmin) return true;
  if (item.visibility === "workspace") return true;
  if (item.visibility === "private") return item.authorId === viewer.userId;
  const sw = item.sharedWith || { departmentIds: [], memberIds: [] };
  return (
    (sw.departmentIds || []).includes(viewer.departmentId || "") ||
    (sw.memberIds || []).includes(viewer.userId || "")
  );
}
