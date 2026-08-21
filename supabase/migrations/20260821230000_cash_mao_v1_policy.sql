-- Cash MAO V1 pricing policy for Evergreen Team.
--
-- The standard MAO is 65% of CashValue less successful Rehab total (including
-- contingency). A separate 68% stretch ceiling may be displayed for human
-- review, but it is not the default MAO and is never autonomous offer authority.
--
-- The historical 70% rule is retained as an inactive audit record so no active
-- pricing path can accidentally fall back to 70%.

do $$
declare
  _workspace_id uuid;
begin
  begin
    select id
    into strict _workspace_id
    from public.workspaces
    where name = 'Evergreen Team';
  exception
    when no_data_found then
      raise exception 'evergreen_workspace_not_found';
    when too_many_rows then
      raise exception 'evergreen_workspace_ambiguous';
  end;

  -- Retire any active 70% ARV-less-repairs standard rule, including the
  -- historical global default. Preserve the rows for audit/history.
  update public.buy_box_criteria
  set active = false,
      updated_at = now()
  where asset_class = 'fix_flip'
    and rule_type = 'pricing'
    and field = 'max_offer_rule'
    and operator = 'formula'
    and active = true
    and value ->> 'rule' = '0.70 * ARV - repairs';

  -- Retire any earlier Evergreen workspace-specific formula rows before
  -- installing the current standard/stretch policy.
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
