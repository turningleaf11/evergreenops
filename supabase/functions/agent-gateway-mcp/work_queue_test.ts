import { MCP_TOOL_ACTIONS, MCP_SERVER_VERSION } from './core.ts';
import { emailInputValidators } from './schemas.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('MCP exposes the Cash queue through the Gateway action map', () => {
  assert(MCP_SERVER_VERSION === '0.11.0');
  assert(MCP_TOOL_ACTIONS.underwriting_next_work_item === 'underwriting.next_work_item');
  assert(MCP_TOOL_ACTIONS.underwriting_rehab === 'underwriting.rehab');
});

Deno.test('Cash queue MCP schema accepts no caller-controlled inputs', () => {
  const validator = emailInputValidators.underwriting_next_work_item;
  assert(validator.safeParse({}).success);
  assert(!validator.safeParse({ opportunity_id: 'opp_123' }).success);
  assert(!validator.safeParse({ work_kind: 'portfolio_napkin' }).success);
});