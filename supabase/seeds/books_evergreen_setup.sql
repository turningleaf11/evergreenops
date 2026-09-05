-- Seed the books with the real Evergreen structure.
--
-- Idempotent: safe to re-run. Ownership percentages are only recorded where
-- Autumn confirmed them. Where they are unknown the partner is still linked to
-- the entity but ownership_pct is left null rather than guessed, because these
-- numbers land on K-1s.

do $seed$
declare
  _ws   uuid := 'a8938ed0-9c4e-4d42-b874-593b4b3c90a9';  -- Evergreen Team
  _thor uuid; _efv uuid; _ec uuid; _r1109 uuid;
  _autumn uuid; _ron uuid; _melanie uuid; _john uuid; _tilisa uuid; _thorp uuid;
  _e record; _o record; _p record;
begin

-- ------------------------------------------------------------------ entities
insert into book_entities (workspace_id, name, legal_name, home_state, notes)
values
  (_ws, 'Thor Legacy',        'Thor Legacy Enterprises, LLC',            'WY',
   'Holding company. No bank account and no direct activity; its return reports the Evergreen Funded K-1 only. Evergreen Creative paid its Wyoming filing fee.'),
  (_ws, 'Evergreen Funded',   'Evergreen Funded Ventures, LLC',          'FL', null),
  (_ws, 'Evergreen Creative', 'Evergreen Creative Home Solutions, LLC',  'FL',
   'Acted as trustee for 1109 Riviera. The 1109 accounts sit under this Mercury organisation but the income belongs to 1109.'),
  (_ws, '1109 Riviera',       '1109 Riviera, LLC',                       'FL',
   'Property sold 2025-11-05. Bank accounts reconcile to exactly zero and are fully drained.')
on conflict (workspace_id, name) do nothing;

select id into _thor  from book_entities where workspace_id=_ws and name='Thor Legacy';
select id into _efv   from book_entities where workspace_id=_ws and name='Evergreen Funded';
select id into _ec    from book_entities where workspace_id=_ws and name='Evergreen Creative';
select id into _r1109 from book_entities where workspace_id=_ws and name='1109 Riviera';

update book_entities set parent_entity_id=_thor where id=_efv and parent_entity_id is null;
update book_entities set final_tax_year=2025 where id=_r1109 and final_tax_year is null;

-- ------------------------------------------------------------------ partners
insert into book_partners (workspace_id, name, legal_name, is_entity, notes) values
  (_ws, 'Autumn Alexander', null, false, null),
  (_ws, 'Ron Poulard',      null, false,
   'Not a member of Evergreen Creative. Payments to him from EC are Autumn''s own draw remitted onward; payments from EFV reimburse 400 Waterside costs he paid personally.'),
  (_ws, 'Melanie Torres',   null, false, null),
  (_ws, 'John Cobblestone', 'Cobblestone 401K Trust', true, null),
  (_ws, 'Tilisa Stubbs',    'Home Equity Real Estate Investments LLC', true,
   'Holds her 1109 interest through her own LLC; the sale distribution was paid to that LLC.'),
  (_ws, 'Thor Legacy (entity)', 'Thor Legacy Enterprises, LLC', true,
   'The holding company as a capital holder in Evergreen Funded.')
on conflict (workspace_id, name) do nothing;

select id into _autumn  from book_partners where workspace_id=_ws and name='Autumn Alexander';
select id into _ron     from book_partners where workspace_id=_ws and name='Ron Poulard';
select id into _melanie from book_partners where workspace_id=_ws and name='Melanie Torres';
select id into _john    from book_partners where workspace_id=_ws and name='John Cobblestone';
select id into _tilisa  from book_partners where workspace_id=_ws and name='Tilisa Stubbs';
select id into _thorp   from book_partners where workspace_id=_ws and name='Thor Legacy (entity)';

-- Confirmed percentages only. Nulls are genuinely unknown, not zero.
insert into book_entity_partners (workspace_id, entity_id, partner_id, ownership_pct, effective_from, notes) values
  (_ws, _thor,  _autumn,  50.0000, '2025-01-01', 'Confirmed'),
  (_ws, _thor,  _ron,     50.0000, '2025-01-01', 'Confirmed'),
  (_ws, _ec,    _melanie, 35.0000, '2025-01-01', 'Confirmed by Autumn'),
  (_ws, _ec,    _autumn,  65.0000, '2025-01-01', 'Inferred as the balance of Melanie''s confirmed 35% - verify'),
  (_ws, _efv,   _thorp,  100.0000, '2025-01-01', 'Wholly owned by Thor Legacy'),
  (_ws, _r1109, _autumn,  null,    '2025-01-01', 'PERCENTAGE UNKNOWN. Held via Evergreen Creative as trustee.'),
  (_ws, _r1109, _john,    null,    '2025-01-01', 'PERCENTAGE UNKNOWN. Took 31,192.84 of the sale distribution.'),
  (_ws, _r1109, _melanie, null,    '2025-01-01', 'PERCENTAGE UNKNOWN. Took 19,885.43 direct from 1109 rather than through EC - open question for the CPA.'),
  (_ws, _r1109, _tilisa,  null,    '2025-01-01', 'PERCENTAGE UNKNOWN. Took 7,067.39 through her LLC.')
on conflict (entity_id, partner_id, effective_from) do nothing;

-- ---------------------------------------------------------- chart of accounts
-- One shared chart per entity. Account names follow the Wave charts already in
-- use so nothing has to be relearned.
for _e in select id, name from book_entities where workspace_id = _ws loop
  insert into book_accounts (workspace_id, entity_id, code, name, account_type, subtype) values
    (_ws,_e.id,'1200','Earnest Money Deposit','asset','other_current'),
    (_ws,_e.id,'1300','Property Manager Clearing','asset','other_current'),
    (_ws,_e.id,'1500','Property','asset','fixed'),
    (_ws,_e.id,'1510','Property Improvements','asset','fixed'),
    (_ws,_e.id,'1590','Accumulated Depreciation','asset','contra_fixed'),
    (_ws,_e.id,'2100','1st Mortgage','liability','long_term'),
    (_ws,_e.id,'2110','Seller Finance Note','liability','long_term'),
    (_ws,_e.id,'2200','Security Deposits','liability','short_term'),
    (_ws,_e.id,'2500','Loan from Related Party','liability','long_term'),
    (_ws,_e.id,'3900','Retained Earnings','equity',null),
    (_ws,_e.id,'4000','Assignment Fee','income',null),
    (_ws,_e.id,'4100','Rental Income - Gross','income',null),
    (_ws,_e.id,'4900','Other Income','income',null),
    (_ws,_e.id,'5000','Commissions Paid','expense','cogs'),
    (_ws,_e.id,'5100','Pay - Independent Contractor','expense','cogs'),
    (_ws,_e.id,'5200','Property Management Fees','expense',null),
    (_ws,_e.id,'6000','Repairs','expense',null),
    (_ws,_e.id,'6010','Regular Maintenance','expense',null),
    (_ws,_e.id,'6020','Landscaping','expense',null),
    (_ws,_e.id,'6030','Turnover Costs','expense',null),
    (_ws,_e.id,'6100','Utilities','expense',null),
    (_ws,_e.id,'6200','Insurance','expense',null),
    (_ws,_e.id,'6250','Escrow (Taxes & Insurance)','expense',null),
    (_ws,_e.id,'6300','Mortgage Interest','expense',null),
    (_ws,_e.id,'6310','Interest Expense','expense',null),
    (_ws,_e.id,'6400','Taxes - Property Tax','expense',null),
    (_ws,_e.id,'6410','Corporate Filing','expense',null),
    (_ws,_e.id,'6420','Licenses and Permits','expense',null),
    (_ws,_e.id,'6500','Professional Fees','expense',null),
    (_ws,_e.id,'6510','Accounting Fees','expense',null),
    (_ws,_e.id,'6600','Computer - Software','expense',null),
    (_ws,_e.id,'6700','Advertising & Promotion','expense',null),
    (_ws,_e.id,'6800','Office Supplies','expense',null),
    (_ws,_e.id,'6810','Education & Training','expense',null),
    (_ws,_e.id,'6820','Travel','expense',null),
    (_ws,_e.id,'6830','Meals and Entertainment','expense',null),
    (_ws,_e.id,'6900','Bank Service Charges','expense',null),
    (_ws,_e.id,'9000','Suspense - Needs Review','expense',null)
  on conflict (workspace_id, entity_id, code) do nothing;
end loop;

-- Due-to / due-from, one pair per entity combination. counterparty_entity_id is
-- what lets the intercompany view prove both legs rather than infer them.
for _e in select id, name from book_entities where workspace_id = _ws loop
  for _o in select id, name from book_entities where workspace_id = _ws and id <> _e.id loop
    insert into book_accounts (workspace_id, entity_id, code, name, account_type, subtype, counterparty_entity_id)
    values
      (_ws,_e.id,'14'||substr(replace(_o.id::text,'-',''),1,4),'Due from '||_o.name,'asset','intercompany',_o.id),
      (_ws,_e.id,'24'||substr(replace(_o.id::text,'-',''),1,4),'Due to '||_o.name,'liability','intercompany',_o.id)
    on conflict (workspace_id, entity_id, code) do nothing;
  end loop;
end loop;

-- A capital account per partner per entity, which is what the K-1s roll up from.
for _e in select e.id, e.name from book_entities e where e.workspace_id = _ws loop
  for _p in select bp.id, bp.name from book_entity_partners ep
             join book_partners bp on bp.id = ep.partner_id
            where ep.entity_id = _e.id loop
    insert into book_accounts (workspace_id, entity_id, code, name, account_type, subtype, partner_id)
    values
      (_ws,_e.id,'30'||substr(replace(_p.id::text,'-',''),1,4),'Contributions - '||_p.name,'equity','contribution',_p.id),
      (_ws,_e.id,'31'||substr(replace(_p.id::text,'-',''),1,4),'Distributions - '||_p.name,'equity','distribution',_p.id)
    on conflict (workspace_id, entity_id, code) do nothing;
  end loop;
end loop;

-- ------------------------------------------------------------- bank accounts
-- org_label records which Mercury organisation the account is held under. It is
-- deliberately not the same as entity_id: the 1109 accounts live under the
-- Evergreen Creative organisation from the trustee period.
insert into book_bank_accounts (workspace_id, entity_id, org_label, display_name, last_four) values
  (_ws,_r1109,'Evergreen Creative','1109 Riviera, LLC','9726'),
  (_ws,_r1109,'Evergreen Creative','1109 Riviera, LLC - Mnt & CapEx','5526'),
  (_ws,_r1109,'Evergreen Creative','Melanie - 1109','1139'),
  (_ws,_r1109,'Evergreen Creative','Tilisa - 1109 - QTRLY','9978'),
  (_ws,_r1109,'Evergreen Creative','Deposits 1109 Riviera','6662'),
  (_ws,_r1109,'1109 Riviera','1109 Riviera LLC - Checking','2184'),
  (_ws,_r1109,'1109 Riviera','1109 Riviera LLC - Savings','2468'),
  (_ws,_ec,   'Evergreen Creative','Evergreen Operations','2459'),
  (_ws,_ec,   'Evergreen Creative','Evergreen Savings','1001'),
  (_ws,_ec,   'Evergreen Creative','Evergreen Checking','3089'),
  (_ws,_ec,   'Evergreen Creative','Evergreen Wires','7521'),
  (_ws,_ec,   'Evergreen Creative','Team Payout','5063'),
  (_ws,_ec,   'Evergreen Creative','Team Profits','1101'),
  (_ws,_ec,   'Evergreen Creative','REI Event Sponsorships','6371'),
  (_ws,_ec,   'Evergreen Creative','Owner Draw','3026'),
  (_ws,_efv,  'Evergreen Funded','400 Waterside St.','8281'),
  (_ws,_efv,  'Evergreen Funded','Evergreen Funded Ops','8105'),
  (_ws,_efv,  'Evergreen Funded','HOI Account','4004'),
  (_ws,_efv,  'Evergreen Funded','EG Funded Transactions','6007'),
  (_ws,_efv,  'Evergreen Funded','Evergreen Funded - Savings','2382')
on conflict (workspace_id, institution, last_four) do nothing;

-- A cash GL account per bank account, so the ledger reconciles account by
-- account rather than as one undifferentiated pile of cash.
for _o in select id, entity_id, display_name, last_four from book_bank_accounts
           where workspace_id = _ws and gl_account_id is null loop
  insert into book_accounts (workspace_id, entity_id, code, name, account_type, subtype)
  values (_ws, _o.entity_id, '10'||_o.last_four, 'Cash - '||_o.display_name, 'asset', 'bank')
  on conflict (workspace_id, entity_id, code) do nothing;

  update book_bank_accounts set gl_account_id = (
    select id from book_accounts
     where workspace_id=_ws and entity_id=_o.entity_id and code='10'||_o.last_four)
   where id = _o.id;
end loop;

-- ------------------------------------------------------------------- periods
insert into book_periods (workspace_id, entity_id, fiscal_year, status)
select _ws, id, y, 'open'
  from book_entities, generate_series(2025, 2026) y
 where workspace_id = _ws
on conflict (entity_id, fiscal_year) do nothing;

end $seed$;
