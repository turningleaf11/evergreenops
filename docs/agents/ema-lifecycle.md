# Ema Durable Lifecycle Semantics

## Purpose

Ema's hourly OpenClaw Automation intentionally re-reads an overlapping Gmail window. Durable Supabase state—not model memory—must answer whether a source message is new, in progress, complete, excluded, or errored.

## Message lifecycle

`ema_messages.processing_status` is a roll-up of its candidate states when candidates exist:

- `extracted` — candidates exist but none has reached a terminal outcome yet.
- `partially_processed` — at least one candidate is terminal while another still needs work.
- `completed` — every candidate reached a terminal outcome (`completed`, `intake_excluded`, or `screen_failed`). A buy-box `not_fit` candidate is terminal even though it never enters CRM.
- `error` — at least one candidate is in an error state and requires retry/operator attention.
- `excluded` — the source message itself was intentionally classified as irrelevant before candidate creation. Candidate roll-up never reopens this state.

The database trigger owns this roll-up so every code path receives the same behavior.

## Candidate lifecycle after buy-box screening

When the buy-box verdict changes and the application did not explicitly set a lifecycle state, Supabase derives:

- `fit` -> `screen_passed`
- `needs_info` -> `screen_needs_info`
- `not_fit` -> `screen_failed`

The trigger does not downgrade a candidate that is already `ghl_pending` or `completed`, which allows later qualification reruns without reopening finished CRM work.

## Two different meanings of `needs_info`

Do not confuse source-intake state with buy-box result:

### `intake_result = supported`

Use this for a real property opportunity that has enough source identity/classification to persist and screen, even when some facts are missing. Put missing facts in `missing_information`. This candidate should continue to `deal_buy_box_fit`.

### `intake_result = needs_info`

Reserve this for a source that is too incomplete or ambiguous to proceed through normal intake safely (for example, unresolved property identity/classification). It is not the same thing as a buy-box `needs_info` result.

### `buy_box_fit_result = needs_info`

This is a reviewable acquisition lead whose active screen has unresolved facts or a human-resolvable exception. It may enter the fixed initial HighLevel review stage when the candidate is otherwise intake-eligible.

## Hourly automation implication

The automation may safely query a 2-hour Gmail lookback every hour:

1. identical Gmail message IDs resolve to the existing durable message;
2. completed/excluded sources are not recreated;
3. partially processed sources can resume unfinished candidate work;
4. `screen_failed` candidates are terminal and do not get retried into CRM;
5. candidate completion automatically closes the parent Gmail message when all sibling candidates are terminal.

This is why the automation should not maintain a model-authored `last_checked_at` cursor as the source of truth.
