-- The 70%-of-ARV rule was stored as hardness='hard' alongside pass/fail criteria,
-- but it doesn't screen a deal — it prices one. An agent evaluating every hard
-- criterion as a gate would reject deals that should simply be offered on at a
-- lower number. Separate the two kinds of rule explicitly.

ALTER TABLE buy_box_criteria
  ADD COLUMN IF NOT EXISTS rule_type text NOT NULL DEFAULT 'screen';

ALTER TABLE buy_box_criteria
  DROP CONSTRAINT IF EXISTS buy_box_criteria_rule_type_check;

ALTER TABLE buy_box_criteria
  ADD CONSTRAINT buy_box_criteria_rule_type_check
  CHECK (rule_type IN ('screen', 'pricing'));

COMMENT ON COLUMN buy_box_criteria.rule_type IS
  'screen = evaluated pass/fail before underwriting. pricing = governs the offer amount, never rejects a deal.';

UPDATE buy_box_criteria
SET rule_type = 'pricing'
WHERE field = 'max_offer_rule';;
