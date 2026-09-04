-- Archive is orthogonal to status (not_started/in_progress/done)
alter table public.projects
  add column if not exists archived boolean not null default false;

-- Atomic cascade delete: tasks SET NULL on project delete (would orphan), and
-- comments/entity_activity/document_links are polymorphic (no FK), so a plain
-- delete leaves them behind. This cleans everything in one transaction.
create or replace function public.delete_project_cascade(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_ids uuid[];
begin
  select array_agg(id) into v_task_ids from tasks where project_id = p_id;

  -- task-scoped polymorphic rows
  if v_task_ids is not null then
    delete from comments        where entity_type = 'task' and entity_id = any(v_task_ids);
    delete from entity_activity where entity_type = 'task' and entity_id = any(v_task_ids);
    delete from document_links  where entity_type = 'task' and entity_id = any(v_task_ids);
  end if;

  delete from tasks where project_id = p_id;

  -- project-scoped polymorphic rows
  delete from comments        where entity_type = 'project' and entity_id = p_id;
  delete from entity_activity where entity_type = 'project' and entity_id = p_id;
  delete from document_links  where entity_type = 'project' and entity_id = p_id;

  -- project_ai_messages + project_attachments cascade via FK
  delete from projects where id = p_id;
end;
$$;

grant execute on function public.delete_project_cascade(uuid) to authenticated;;
