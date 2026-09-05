-- Register Marquetta in the agent fleet.
--
-- Created DISABLED on purpose. agent_task_claim_next returns no work for a
-- disabled agent, so the row can exist — and her Gateway permissions can be
-- granted and inspected — well before she is allowed to do anything. She is
-- enabled only after the acceptance steps in
-- docs/agents/marquetta-content-automation.md pass, the last of which is
-- confirming her MCP tools are actually registered rather than merely
-- allowlisted.
--
-- This row is also the kill switch: setting enabled = false stops her claiming
-- work immediately, with no container stop, credential revoke or Automation
-- edit needed.

insert into agents (name, slug, emoji, role, type, status, subtitle, bio, enabled)
values (
  'Marquetta',
  'marquetta',
  '🎯',
  'Marketing & Content',
  'ai',
  'offline',
  'Marketing and content agent',
  'Captures content seeds from real business events, researches content and '
  'marketing trends, drafts per-brand per-platform content in the brand''s own '
  'voice, orchestrates video clipping through an external tool, and queues '
  'everything for human review. Never publishes on her own authority.',
  false
)
on conflict (slug) do nothing;
