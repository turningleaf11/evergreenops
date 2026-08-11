# Scope — Document extraction in Napkin

**Repo:** `turningleaf11/evergreennapkin` · **Supabase project:** `mgciyywyhpajpxozfaul`
*(note: this is Napkin's own project, NOT OpsHQ's `dsxrekabnwvarnroanny`)*

Upload a broker's OM, T12, or rent roll and have Napkin populate the deal inputs
that come from those documents — with every extracted value traceable to the page
it came from, and nothing written until a human accepts it.

---

## Why this and not the MCP write-path

The original plan was to let Cash create and prefill deals over MCP. Reading the
code changed that:

- Of Napkin's **88 input fields, 72 already carry real defaults.** Only ~16 default
  to zero or empty, and several of those are offer prices — scenario outputs, not
  document facts. The genuinely document-derived set is about **a dozen fields**.
- So the typing burden is roughly ten numbers, not a hundred. The actual work is
  **reading a forty-page OM and T12 to find those ten numbers** — and no extraction
  exists anywhere in the app today.

Automating the write while leaving the read manual solves the cheap half. This
scope does the expensive half, and does it where the underwriter already is.

---

## What already exists (build on it, don't reinvent)

| Thing | Where | Note |
|---|---|---|
| LLM gateway | `supabase/functions/broker-feedback/index.ts` | Lovable AI Gateway, `LOVABLE_API_KEY`, `https://ai.gateway.lovable.dev/v1/chat/completions`, currently `google/gemini-3-flash-preview` |
| AI dialog pattern | `src/components/underwriting/BrokerFeedbackDialog.tsx` | Working example of trigger → edge function → render result |
| Input surface | `src/components/underwriting/InputPanel.tsx` | Where extracted values ultimately land |
| Input schema | `src/lib/underwriting-calculations.ts` → `defaultInputs` | 88 fields, the contract for what may be written |
| Storage | — | **Nothing.** No bucket, no upload path anywhere in the app |

---

## Fields in scope

Extract **only** what a document states as fact.

| Field | Source document |
|---|---|
| `propertyName`, `propertyAddress` | OM / listing |
| `askingPrice` | OM / listing |
| `units` | OM, verified against rent roll |
| `grossMonthlyRents` | Rent roll — sum of current in-place rents |
| `otherIncome` | T12 |
| `expenseAmount` | T12 — total operating expenses |
| `stackTaxesMo`, `stackInsuranceMo`, `stackUtilitiesMo` | T12 line items |
| `stackAvgRentPerUnit`, `stackOccupancyPct` | Rent roll |
| `existingDebtBalance`, `existingDebtRate`, `existingDebtPayment` | Loan docs, only if assumable |

### Explicitly out of scope — never extract these

`vacancyRate`, `expenseRate`, `exitCapRate`, `marketCapRate`, `interestRate`,
`annualRentGrowth`, `annualExpenseGrowth`, every `min*` threshold, and all refi and
seller-finance assumptions.

These are **house judgment, not document facts.** A broker's pro-forma states a
vacancy rate and an exit cap; those are marketing, not data. Extracting them would
quietly import the seller's assumptions into our model — the exact failure the
underwriting guardrails exist to prevent. If the model sees them, it ignores them.

**In-place rents are facts. Pro-forma rents are not.** When a rent roll shows both,
take current and ignore projected.

---

## Architecture

```
Upload (PDF/XLSX)  →  edge fn: extract-deal-inputs  →  review panel  →  apply to inputs
     client              Lovable gateway, structured        human          existing
                         output, returns per-field          accepts        setInputs
                         value + confidence + page          or edits       path
```

### v1 deliberately skips storage

Send the file to the edge function as base64 in the request body; don't persist it.
That removes a storage bucket, its RLS policies, and a retention decision from the
critical path. If keeping documents on the deal turns out to be wanted, that's a
clean follow-up — and by then there'll be real usage to justify the shape.

Practical limit: keep uploads under ~10 MB in v1 and say so in the UI.

### The edge function

`supabase/functions/extract-deal-inputs/index.ts`

- Mirror `broker-feedback` for CORS, key handling, and error shape.
- Gemini reads PDFs natively — pass the document, don't pre-parse it.
- Use **structured output** (JSON schema) so the response is typed, not prose.
- Every field returns:

```json
{
  "field": "grossMonthlyRents",
  "value": 31200,
  "confidence": "high" | "medium" | "low",
  "source": "Rent roll, p.4 — sum of 24 in-place rents",
  "note": "Two units vacant; excluded from total"
}
```

- Omit a field entirely rather than guessing. A missing field is honest; a
  low-confidence invented one is a landmine.
- Validate every returned key against `defaultInputs` and drop unknown keys —
  a hallucinated field name must never reach the model.

### The review panel

This is the part that determines whether the feature is trustworthy, so it isn't
optional polish.

- Show each extracted field as a row: **field name · current value → proposed
  value · confidence · source**.
- Every row individually accept/reject/editable. Nothing writes on extraction.
- Default low-confidence rows to **unchecked** so accepting everything doesn't
  silently take the weak ones.
- Keep the source string visible, not behind a tooltip. A number you can't trace
  back to a page in the T12 is worse than no number, because it looks authoritative.
- Applying uses the existing input-setting path, so recalculation happens exactly
  as it does when a human types.

---

## Cost

Flash-tier model, and PDFs are the expensive input — a scanned forty-page OM costs
far more than a clean digital T12. Expect low single-digit cents per document.
Worth confirming against Lovable's gateway pricing, since that's the billing path
and their rates govern, not the underlying model's list price.

If cost becomes real: extract from T12 and rent roll only (where the numbers
actually live) and let the OM fields be typed — those are four easy ones.

---

## Build order

1. Upload control + file→base64 plumbing (dialog, following `BrokerFeedbackDialog`)
2. `extract-deal-inputs` edge function with the schema above
3. Review panel
4. Apply path into existing inputs
5. Manual test against three real documents — a clean digital T12, a scanned OM,
   and a messy rent roll. The scanned one is the honest test.

---

## Definition of done

- A real broker package populates the document-derived fields in one pass.
- Every populated field shows where it came from.
- Nothing is written without a human accepting it.
- No assumption field is ever touched by extraction.
- A scanned PDF either works or fails clearly — never silently returns wrong numbers.

---

## Not in this scope

- Storing documents on the deal (deliberate v1 cut)
- The MCP write-path (`create_deal`, `update_deal_inputs`) — still useful later for
  Cash, not needed for this
- Buy box screening — that's Cash's job, upstream of Napkin entirely
