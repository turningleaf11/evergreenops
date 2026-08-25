import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import {
  createGhlContactNote,
  getGhlOpportunity,
  GhlReadError,
  listGhlContactNotes,
  resolveGhlContext,
} from '../_shared/ghl.ts';

export interface CashUnderwritingNoteResult {
  status: 'created' | 'existing' | 'failed';
  note_id: string | null;
  error_code: string | null;
}

export async function ensureCashUnderwritingNote(
  admin: SupabaseClient,
  workspaceId: string,
  opportunityId: string,
  workItemId: string,
  activationCount: number,
  fetchImpl: typeof fetch = fetch,
): Promise<CashUnderwritingNoteResult> {
  try {
    const outputs = await loadOutputs(admin, workItemId, activationCount);
    const ghl = await resolveGhlContext(admin);
    const opportunity = await getGhlOpportunity(ghl, opportunityId, fetchImpl);
    const contactId = stringValue(opportunity.contact_id);
    if (!contactId) return { status: 'failed', note_id: null, error_code: 'ghl_opportunity_contact_missing' };

    const marker = `[Evergreen Cash Underwriting | ${opportunityId} | activation ${activationCount}]`;
    const existing = await listGhlContactNotes(ghl, contactId, fetchImpl);
    const notes = Array.isArray(existing.notes) ? existing.notes.filter(isRecord) : [];
    const match = notes.find((note) => typeof note.body === 'string' && note.body.includes(marker));
    if (match) {
      return {
        status: 'existing',
        note_id: stringValue(match.id),
        error_code: null,
      };
    }

    const body = formatCashUnderwritingNote(outputs, marker);
    const created = await createGhlContactNote(ghl, contactId, body, fetchImpl);
    return {
      status: 'created',
      note_id: stringValue(created.id),
      error_code: null,
    };
  } catch (error) {
    return {
      status: 'failed',
      note_id: null,
      error_code: error instanceof GhlReadError
        ? error.code
        : error instanceof Error
        ? error.message.slice(0, 120)
        : 'cash_underwriting_note_failed',
    };
  }
}

export function formatCashUnderwritingNote(
  outputs: Record<string, Record<string, unknown>>,
  marker = '[Evergreen Cash Underwriting]',
): string {
  const cashValueOutput = outputs.cash_value ?? {};
  const rehabOutput = outputs.rehab ?? {};
  const maoOutput = outputs.mao ?? {};
  const flipOutput = outputs.flip_analysis ?? {};
  const cashValue = record(cashValueOutput.cash_value);
  const range = record(cashValue.supported_range);
  const subject = record(cashValueOutput.subject);
  const classification = record(rehabOutput.classification);
  const rehabTotal = record(rehabOutput.total);
  const knownAdders = Array.isArray(rehabOutput.known_adders)
    ? rehabOutput.known_adders.filter(isRecord)
    : [];
  const comps = Array.isArray(cashValue.selected_comps)
    ? cashValue.selected_comps.filter(isRecord)
    : [];

  const lines: string[] = [
    'CASH UNDERWRITING',
    `Property: ${stringValue(subject.address) ?? 'Unknown'}`,
    '',
    'CASHVALUE',
    `CashValue: ${money(cashValue.cash_value)} | Confidence: ${title(stringValue(cashValue.confidence) ?? 'unknown')}`,
    `Supported Range: ${money(range.low)} - ${money(range.high)}`,
    `Provider: ${title(stringValue(cashValueOutput.comp_source) ?? 'unknown')}`,
    '',
    'SELECTED SOLD COMPS',
  ];

  if (comps.length === 0) {
    lines.push('No selected comps persisted.');
  } else {
    comps.forEach((comp, index) => {
      const beds = numberValue(comp.beds);
      const baths = numberValue(comp.baths);
      const sqft = numberValue(comp.sqft);
      const details = [
        sqft === null ? null : `${formatNumber(sqft)} sf`,
        beds === null || baths === null ? null : `${formatNumber(beds)}/${formatNumber(baths)}`,
        numberValue(comp.distance_miles) === null ? null : `${formatNumber(numberValue(comp.distance_miles)!)} mi`,
        numberValue(comp.price_per_sqft) === null ? null : `${money(comp.price_per_sqft)}/sf`,
      ].filter(Boolean).join(' | ');
      lines.push(
        `${index + 1}. ${stringValue(comp.address) ?? 'Unknown comp'} — Sold ${money(comp.sale_price)} on ${stringValue(comp.sale_date) ?? 'date unavailable'}`,
      );
      if (details) lines.push(`   ${details}`);
      if (numberValue(comp.implied_subject_value) !== null) {
        lines.push(`   Implied subject value: ${money(comp.implied_subject_value)}`);
      }
    });
  }

  if (Object.keys(rehabOutput).length) {
    lines.push('', 'ACQUISITION REHAB');
    lines.push(
      `Class: ${stringValue(classification.label) ?? title(stringValue(classification.rehab_class) ?? 'unknown')} | Confidence: ${title(stringValue(rehabOutput.confidence) ?? stringValue(classification.confidence) ?? 'unknown')}`,
    );
    if (stringValue(classification.basis)) lines.push(`Basis: ${stringValue(classification.basis)}`);
    lines.push(`Range: ${money(rehabTotal.low)} - ${money(rehabTotal.high)}`);
    lines.push(`Modeled Rehab: ${money(rehabOutput.modeled_rehab ?? rehabTotal.base)}${rehabOutput.modeled_rehab_basis === 'high_due_to_unknown_condition' ? ' (high-side default due to unknown condition)' : ''}`);
    if (knownAdders.length) {
      lines.push('Known Major Adders:');
      knownAdders.forEach((adder) => {
        lines.push(`- ${title(stringValue(adder.adder_type) ?? 'adder')}: ${money(adder.cost_base)} (${stringValue(adder.description) ?? 'source-backed repair'})`);
      });
    } else {
      lines.push('Known Major Adders: None currently identified.');
    }
  }

  if (Object.keys(maoOutput).length) {
    lines.push('', 'PRICING');
    lines.push(`Standard MAO: ${money(maoOutput.standard_mao)}`);
    lines.push(`Human-Review Stretch Ceiling: ${money(maoOutput.stretch_ceiling)}`);
  }

  if (Object.keys(flipOutput).length) {
    lines.push('', 'FLIP ANALYSIS');
    lines.push(`Status: ${title(stringValue(flipOutput.status) ?? 'unknown')}`);
    const standard = record(flipOutput.standard);
    if (Object.keys(standard).length) {
      lines.push(`Standard Net Profit: ${money(standard.net_profit)}`);
      if (numberValue(standard.return_on_cost_pct) !== null) lines.push(`Return on Cost: ${formatNumber(numberValue(standard.return_on_cost_pct)!)}%`);
    }
    const missing = Array.isArray(flipOutput.missing_input_fields)
      ? flipOutput.missing_input_fields.filter((value): value is string => typeof value === 'string')
      : [];
    if (missing.length) lines.push(`Still Needed: ${missing.join(', ')}`);
  }

  lines.push('', marker);
  return lines.join('\n').slice(0, 5000);
}

async function loadOutputs(
  admin: SupabaseClient,
  workItemId: string,
  activationCount: number,
): Promise<Record<string, Record<string, unknown>>> {
  const { data, error } = await admin
    .from('cash_underwriting_steps')
    .select('phase, output')
    .eq('cash_work_item_id', workItemId)
    .eq('activation_count', activationCount)
    .in('phase', ['cash_value', 'rehab', 'mao', 'flip_analysis']);
  if (error) throw new Error('cash_underwriting_note_steps_lookup_failed');
  const result: Record<string, Record<string, unknown>> = {};
  for (const row of data ?? []) {
    if (typeof row.phase === 'string' && isRecord(row.output)) result[row.phase] = row.output;
  }
  return result;
}

function money(value: unknown): string {
  const number = numberValue(value);
  return number === null
    ? 'N/A'
    : `$${Math.round(number).toLocaleString('en-US')}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString('en-US')
    : value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function title(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/[$,%\s,]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
