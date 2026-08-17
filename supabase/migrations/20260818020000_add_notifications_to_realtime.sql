-- Powers the unread-entity indicator (useUnreadEntityIds) — new/read
-- notifications need to update the dot on task/project cards live.
alter publication supabase_realtime add table public.notifications;
