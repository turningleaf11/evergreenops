import {
  collapsePendingActivationSignals,
  isActivationLeaseConflict,
} from './cash_work_jit.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`Expected ${e}, received ${a}`);
}

Deno.test('Cash JIT keeps only the newest pending activation per opportunity', () => {
  const signals = [
    {
      id: 'a-old',
      ghl_opportunity_id: 'opp-a',
      activation_count: 1,
      activated_at: '2026-09-03T10:00:00Z',
      created_at: '2026-09-03T10:00:01Z',
    },
    {
      id: 'b-current',
      ghl_opportunity_id: 'opp-b',
      activation_count: 1,
      activated_at: '2026-09-03T11:00:00Z',
      created_at: '2026-09-03T11:00:01Z',
    },
    {
      id: 'a-current',
      ghl_opportunity_id: 'opp-a',
      activation_count: 2,
      activated_at: '2026-09-03T12:00:00Z',
      created_at: '2026-09-03T12:00:01Z',
    },
  ];

  const result = collapsePendingActivationSignals(signals);
  assertEquals(result.latest.map((signal) => signal.id), ['b-current', 'a-current']);
  assertEquals(result.superseded.map((signal) => signal.id), ['a-old']);
});

Deno.test('Cash JIT treats activation_count as the authoritative re-entry identity', () => {
  const result = collapsePendingActivationSignals([
    {
      id: 'newer-count',
      ghl_opportunity_id: 'opp-a',
      activation_count: 3,
      activated_at: '2026-09-03T09:00:00Z',
      created_at: '2026-09-03T09:00:01Z',
    },
    {
      id: 'newer-clock-only',
      ghl_opportunity_id: 'opp-a',
      activation_count: 2,
      activated_at: '2026-09-03T12:00:00Z',
      created_at: '2026-09-03T12:00:01Z',
    },
  ]);

  assertEquals(result.latest.map((signal) => signal.id), ['newer-count']);
  assertEquals(result.superseded.map((signal) => signal.id), ['newer-clock-only']);
});

Deno.test('Cash JIT recognizes the database lease fence as a deferrable claim conflict', () => {
  assert(isActivationLeaseConflict({
    code: 'P0001',
    message: 'cash_work_item_activation_lease_active',
  }));
  assertEquals(isActivationLeaseConflict({
    code: 'P0001',
    message: 'some_other_database_error',
  }), false);
  assertEquals(isActivationLeaseConflict({
    code: '23505',
    message: 'cash_work_item_activation_lease_active',
  }), false);
});
