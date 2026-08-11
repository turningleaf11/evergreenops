/**
 * Starting sections for a new business plan doc.
 *
 * Seeded, not enforced — every heading is ordinary editable content the user
 * can rename, reorder or delete. This follows how the real authoring tools
 * work (LivePlan's editable outline, Notion's template pages): a blank page
 * is paralysing, a locked form is a questionnaire, and the useful middle is
 * a starting structure you write over.
 *
 * Kept to the narrative sections only. Anything with an owner, a date or a
 * status lives as a real record instead — a goal, milestone, risk, or
 * deliverable — so nothing here duplicates a tracked list.
 */

export type PlanSection = { heading: string; prompt: string };

const GENERIC: PlanSection[] = [
  { heading: "Thesis", prompt: "What is this venture, and why will it work?" },
  { heading: "Customer & market", prompt: "Who buys from you, and why you over the alternatives?" },
  { heading: "Offer", prompt: "What you sell, how it's priced, and what the customer actually gets." },
  { heading: "How we get customers", prompt: "Where demand comes from — channels, referrals, marketing, sales process." },
  { heading: "Operations", prompt: "How the work actually runs day to day, and where the bottleneck is." },
  { heading: "Team", prompt: "Who's needed, which seats are filled, and which are open." },
  { heading: "Money", prompt: "What it costs to run, what it earns, and what has to be true to break even." },
  { heading: "What could go wrong", prompt: "The risks worth naming, and what you'd do about them." },
];

/**
 * Type-specific sections, matched loosely on the free-text venture type.
 * Replaces a generic section rather than adding to it, so the outline stays
 * roughly the same length whatever the venture.
 */
const BY_TYPE: { match: RegExp; replace: string; section: PlanSection }[] = [
  {
    match: /flip|wholesal|real estate|rental|property|buy.?and.?hold|multifamily/i,
    replace: "Customer & market",
    section: { heading: "Buy box & market", prompt: "Which markets, what property profile, what numbers make a deal a yes." },
  },
  {
    match: /flip|wholesal|rehab|construction/i,
    replace: "Offer",
    section: { heading: "Renovation & disposition", prompt: "Scope standards, who does the work, and how you exit each deal." },
  },
  {
    match: /saas|software|app|platform|tech/i,
    replace: "Offer",
    section: { heading: "Product & pricing", prompt: "What the product does, how it's packaged, and what a customer pays." },
  },
  {
    match: /service|agency|consult|coaching/i,
    replace: "Offer",
    section: { heading: "Services & delivery", prompt: "What you deliver, how it's scoped, and what delivery costs you." },
  },
  {
    match: /ecommerce|e-commerce|retail|product|brand/i,
    replace: "Operations",
    section: { heading: "Sourcing & fulfilment", prompt: "Where product comes from, margins, inventory and shipping." },
  },
];

export function sectionsForType(type: string | null | undefined): PlanSection[] {
  const t = (type || "").trim();
  if (!t) return GENERIC;

  const sections = [...GENERIC];
  const used = new Set<string>();
  for (const rule of BY_TYPE) {
    if (!rule.match.test(t) || used.has(rule.replace)) continue;
    const i = sections.findIndex((s) => s.heading === rule.replace);
    if (i !== -1) {
      sections[i] = rule.section;
      used.add(rule.replace);
    }
  }
  return sections;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Build the doc body. `intro` (the purpose captured at creation) becomes the
 * opening paragraph — the user's own words, not generated filler.
 */
export function buildPlanDoc(type: string | null | undefined, intro?: string | null): string {
  const sections = sectionsForType(type);
  const opening = intro?.trim() ? `<p>${escapeHtml(intro.trim())}</p>` : "";
  const body = sections
    .map((s) => `<h2>${escapeHtml(s.heading)}</h2><p><em>${escapeHtml(s.prompt)}</em></p>`)
    .join("");
  return `${opening}${body}`;
}
