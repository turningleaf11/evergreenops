# Napkin MCP — write-path tools

Two tools that give Cash the ability to **create a deal** and **prefill its
underwriting inputs** in evergreennapkin. Today Napkin's MCP server can list
deals, read a deal, and write notes — but nothing can set inputs, so "extract a
T12 and prefill the model" isn't possible.

## What MCP is, briefly

MCP (Model Context Protocol) is the standard way an AI agent talks to a tool.
Napkin already runs an MCP server (`src/lib/mcp/index.ts`) — that's what lets an
agent ask it for deals conversationally instead of through a custom API. Adding
a tool means adding a file and registering it. Nothing else changes; the app
itself is untouched.

## Install

1. Copy both files into `src/lib/mcp/tools/` in the evergreennapkin repo:
   - `create-deal.ts`
   - `update-deal-inputs.ts`

2. Register them in `src/lib/mcp/index.ts`:

```ts
import createDeal from "./tools/create-deal";
import updateDealInputs from "./tools/update-deal-inputs";

export default defineMcp({
  // ...unchanged...
  tools: [listDeals, getDeal, updateDealNotes, createDeal, updateDealInputs],
});
```

3. Deploy. No migration, no schema change — `deals.inputs` is already JSONB.

## Design notes

**Unknown field names are rejected, not ignored.** Both tools validate incoming
keys against `defaultInputs` from `underwriting-calculations.ts`. A typo'd field
that silently does nothing is worse than an error, because the deal then gets
underwritten on a default the caller believed they had overridden.

**`update_deal_inputs` merges, never replaces.** Cash learns a deal in passes —
units and rents from a rent roll, expenses from a T12, debt terms once financing
is chosen. Replace-semantics would wipe the other 90+ fields on every call.

**Permissions are RLS's job.** Both tools use the caller's token, same as the
existing tools. A missing row means "not found or not permitted" — no separate
authorization logic to keep in sync.

## What this unlocks

Once these exist, Cash can go from a broker's emailed T12 to a populated Napkin
deal without anyone typing into a hundred input boxes — which is the single
largest time sink in multifamily underwriting today.
