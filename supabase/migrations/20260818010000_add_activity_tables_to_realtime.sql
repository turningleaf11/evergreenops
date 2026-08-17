-- ActivityPanel's realtime subscription (src/components/activity/ActivityPanel.tsx)
-- listens for postgres_changes on comments/entity_activity/crm_activities, but
-- none of these tables had ever been added to the supabase_realtime publication —
-- so the subscription silently never fired and new comments (e.g. on a task)
-- only appeared after a manual page refresh.
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.entity_activity;
alter publication supabase_realtime add table public.crm_activities;
