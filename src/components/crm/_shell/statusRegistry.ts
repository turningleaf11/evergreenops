/**
 * Unified status / tag color registry for CRM detail sheets.
 *
 * Every entity status, lane, type, temperature, or stage that renders as a
 * pill should resolve through this registry so all five detail sheets
 * (Lead, Contact, Deal, Transaction, Company) look identical.
 *
 * Colors are HSL tokens (or CSS variables resolving to HSL) — never raw hex.
 */

export type StatusVariant = {
  /** HSL token (e.g. "220 70% 50%") OR CSS var ref (e.g. "var(--brand-azure)") */
  color: string;
  /** Display label (already capitalized / formatted) */
  label: string;
};

const NEUTRAL: StatusVariant = { color: "220 12% 55%", label: "—" };

// --- Lead temperature ---
const LEAD_TEMPERATURE: Record<string, StatusVariant> = {
  cold: { color: "var(--brand-azure)", label: "Cold" },
  warm: { color: "var(--brand-tangerine)", label: "Warm" },
  hot: { color: "var(--brand-coral)", label: "Hot" },
};

// --- Lead status ---
const LEAD_STATUS: Record<string, StatusVariant> = {
  new: { color: "var(--brand-azure)", label: "New" },
  working: { color: "var(--brand-tangerine)", label: "Working" },
  qualified: { color: "var(--brand-mint)", label: "Qualified" },
  converted: { color: "var(--brand-mint-deep)", label: "Converted" },
  archived: { color: "220 12% 55%", label: "Archived" },
  disqualified: { color: "220 12% 55%", label: "Disqualified" },
};

// --- Contact status ---
const CONTACT_STATUS: Record<string, StatusVariant> = {
  lead: { color: "210 70% 50%", label: "Lead" },
  active: { color: "142 76% 36%", label: "Active" },
  customer: { color: "262 70% 55%", label: "Customer" },
  lost: { color: "0 70% 50%", label: "Lost" },
};

// --- Contact type (re-exposed here for unified rendering) ---
import {
  CONTACT_TYPE_COLOR,
  CONTACT_TYPE_LABEL,
} from "../contactTypes";
const CONTACT_TYPE: Record<string, StatusVariant> = Object.fromEntries(
  Object.keys(CONTACT_TYPE_LABEL).map((k) => [
    k,
    { color: CONTACT_TYPE_COLOR[k as keyof typeof CONTACT_TYPE_COLOR], label: CONTACT_TYPE_LABEL[k as keyof typeof CONTACT_TYPE_LABEL] },
  ]),
);

// --- Deal stage (resolved by normalized name) ---
const DEAL_STAGE: Record<string, StatusVariant> = {
  buy_box_check: { color: "220 12% 55%", label: "Buy Box Check" },
  quick_underwrite: { color: "var(--brand-azure)", label: "Quick Underwrite" },
  broker_feedback: { color: "var(--brand-tangerine)", label: "Broker Feedback" },
  deep_underwrite: { color: "var(--brand-azure)", label: "Deep Underwrite" },
  loi_sent: { color: "var(--brand-violet)", label: "LOI Sent" },
  due_diligence: { color: "var(--brand-tangerine)", label: "Due Diligence" },
  under_contract: { color: "var(--brand-mint)", label: "Under Contract" },
  closed: { color: "var(--brand-mint-deep)", label: "Closed" },
  dead: { color: "var(--brand-coral)", label: "Dead" },
};

// --- Deal status ---
const DEAL_STATUS: Record<string, StatusVariant> = {
  open: { color: "var(--brand-azure)", label: "Open" },
  won: { color: "var(--brand-mint-deep)", label: "Won" },
  lost: { color: "var(--brand-coral)", label: "Lost" },
};

// --- Transaction lane ---
const TRANSACTION_LANE: Record<string, StatusVariant> = {
  wholesale: { color: "var(--brand-azure)", label: "Wholesale" },
  portfolio: { color: "var(--brand-mint)", label: "Portfolio" },
};

// --- Transaction type ---
const TRANSACTION_TYPE: Record<string, StatusVariant> = {
  assign: { color: "var(--brand-violet)", label: "Assign" },
  double_close: { color: "var(--brand-tangerine)", label: "Double Close" },
  buy: { color: "var(--brand-azure)", label: "Buy" },
};

// --- Transaction status ---
const TRANSACTION_STATUS: Record<string, StatusVariant> = {
  active: { color: "var(--brand-azure)", label: "Active" },
  closed: { color: "var(--brand-mint-deep)", label: "Closed" },
  cancelled: { color: "220 10% 50%", label: "Cancelled" },
};

// --- Company tier (placeholder — companies table is light today) ---
const COMPANY_TIER: Record<string, StatusVariant> = {
  strategic: { color: "var(--brand-mint-deep)", label: "Strategic" },
  partner: { color: "var(--brand-azure)", label: "Partner" },
  vendor: { color: "var(--brand-tangerine)", label: "Vendor" },
  other: { color: "220 12% 55%", label: "Other" },
};

const REGISTRIES = {
  lead_temperature: LEAD_TEMPERATURE,
  lead_status: LEAD_STATUS,
  contact_status: CONTACT_STATUS,
  contact_type: CONTACT_TYPE,
  deal_stage: DEAL_STAGE,
  deal_status: DEAL_STATUS,
  transaction_lane: TRANSACTION_LANE,
  transaction_type: TRANSACTION_TYPE,
  transaction_status: TRANSACTION_STATUS,
  company_tier: COMPANY_TIER,
} as const;

export type RegistryKind = keyof typeof REGISTRIES;

function normalize(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().trim().replace(/\s+/g, "_");
}

export function resolveStatus(
  kind: RegistryKind,
  value: string | null | undefined,
): StatusVariant {
  const reg = REGISTRIES[kind];
  const key = normalize(value);
  return reg[key] ?? { ...NEUTRAL, label: value || NEUTRAL.label };
}
