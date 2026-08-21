-- Cash MAO V1 pricing policy for Evergreen Team.
--
-- The standard MAO is 65% of CashValue less successful Rehab total (including
-- contingency). A separate 68% stretch ceiling may be displayed for human
-- review, but it is not the default MAO and is never autonomous offer authority.
--
-- These are workspace-specific overrides. The historical/global pricing rule
-- remains untouched for audit/history and is shadowed by the workspace rule.

do $$
declare
  _workspace_id uuid := 'a8938ed0-9c4e-4d42-b874-593b4b3c90a9'::uuid;
begin
  if not exists (select 1 from public.workspaces where id = _workspace_id) then
    raise exception 'evergreen_workspace_not_found';
  end if;

  update public.buy_box_criteria
  set active = false,
      updated_at = now()
  where workspace_id = _workspace_id
    and asset_class = 'fix_flip'
    and rule_type = 'pricing'
    and operator = 'formula'
    and field in ('max_offer_rule', 'stretch_offer_rule')
    and active = true;

  insert into public.buy_box_criteria (
    workspace_id,
    asset_class,
    field,
    operator,
    value,
    hardness,
    label,
    active,
    notes,
    rule_type
  ) values (
    _workspace_id,
    'fix_flip',
    'max_offer_rule',
    'formula',
    '{"rule":"0.65 * ARV - repairs"}'::jsonb,
    'hard',
    'Standard MAO: 65% ARV less repairs',
    true,
    'Evergreen standard MAO. Uses CashValue as ARV and successful Rehab total including contingency as repairs.',
    'pricing'
  );

  insert into public.buy_box_criteria (
    workspace_id,
    asset_class,
    field,
    operator,
    value,
    hardness,
    label,
    active,
    notes,
    rule_type
  ) values (
    _workspace_id,
    'fix_flip',
    'stretch_offer_rule',
    'formula',
    '{"rule":"0.68 * ARV - repairs"}'::jsonb,
    'soft',
    'Stretch ceiling: 68% ARV less repairs',
    true,
    'Human approval required above standard 65% MAO. This is a ceiling for stretch consideration, not the default MAO.',
    'pricing'
  );
end;
$$;
