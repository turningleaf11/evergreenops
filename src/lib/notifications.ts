import { supabase } from "@/integrations/supabase/client";

type WatchedEntityType = "task" | "project";

/**
 * Notify a task/project's assignee + followers (projects also have a
 * separate owner_id) when someone comments — skips the comment's own
 * author. Builds on the existing generic `notifications` table rather than
 * a new per-entity read-tracking column.
 */
export async function notifyEntityWatchers(params: {
  entityType: WatchedEntityType;
  entityId: string;
  authorId: string;
  actorName?: string | null;
  bodyPreview: string;
  url: string;
}) {
  const { entityType, entityId, authorId, actorName, bodyPreview, url } = params;

  const recipients = new Set<string>();
  if (entityType === "task") {
    const { data } = await supabase.from("tasks")
      .select("assigned_to, followers")
      .eq("id", entityId)
      .maybeSingle();
    if (!data) return;
    if (data.assigned_to) recipients.add(data.assigned_to);
    (data.followers || []).forEach((uid: string) => recipients.add(uid));
  } else {
    const { data } = await supabase.from("projects")
      .select("owner_id, assignees, followers")
      .eq("id", entityId)
      .maybeSingle();
    if (!data) return;
    if (data.owner_id) recipients.add(data.owner_id);
    (data.assignees || []).forEach((uid: string) => recipients.add(uid));
    (data.followers || []).forEach((uid: string) => recipients.add(uid));
  }
  recipients.delete(authorId);
  if (recipients.size === 0) return;

  const rows = Array.from(recipients).map((user_id) => ({
    user_id,
    actor_id: authorId,
    actor_name: actorName || null,
    type: "comment",
    entity_type: entityType,
    entity_id: entityId,
    body: bodyPreview.slice(0, 140) || null,
    url,
  }));
  await supabase.from("notifications").insert(rows);
}

/** Marks all of one user's unread notifications for a given entity as read — call when the entity's detail view opens. */
export async function markEntityNotificationsRead(entityType: WatchedEntityType, entityId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .is("read_at", null);
}
