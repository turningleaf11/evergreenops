// Shared metadata for contact_type — values, labels, and badge colors.

export const CONTACT_TYPES = [
  "wholesaler",
  "broker",
  "buyer",
  "title_agent",
  "attorney",
  "lender",
  "contractor",
  "investor",
  "other",
] as const;

export type ContactType = (typeof CONTACT_TYPES)[number];

export const CONTACT_TYPE_LABEL: Record<ContactType, string> = {
  wholesaler: "Wholesaler",
  broker: "Broker",
  buyer: "Buyer",
  title_agent: "Title Agent",
  attorney: "Attorney",
  lender: "Lender",
  contractor: "Contractor",
  investor: "Investor",
  other: "Other",
};

// HSL tokens — aligned with brand palette in index.css.
// azure, mint, muted purple, tangerine, gray
export const CONTACT_TYPE_COLOR: Record<ContactType, string> = {
  wholesaler: "var(--brand-azure)",        // azure
  broker: "var(--brand-azure)",            // azure
  buyer: "var(--brand-mint)",              // mint green
  title_agent: "var(--brand-purple-muted)",// muted purple
  attorney: "var(--brand-purple-muted)",   // muted purple
  lender: "var(--brand-tangerine)",        // tangerine
  contractor: "220 12% 60%",               // gray
  investor: "220 12% 60%",                 // gray
  other: "220 12% 60%",                    // gray
};

export function contactTypeColor(t: string | null | undefined): string {
  const key = (t || "other") as ContactType;
  return CONTACT_TYPE_COLOR[key] ?? CONTACT_TYPE_COLOR.other;
}

export function contactTypeLabel(t: string | null | undefined): string {
  const key = (t || "other") as ContactType;
  return CONTACT_TYPE_LABEL[key] ?? "Other";
}

export const PREFERRED_CONTACT_METHODS = ["email", "phone", "text"] as const;
export type PreferredContactMethod = (typeof PREFERRED_CONTACT_METHODS)[number];
