

# Clean Up Strategy Tab — Collapse Vision into Accordion

## What changes

The Strategy tab currently has Vision taking up 6+ full cards at the top, pushing the active strategy tools (Strategy Creator, Review Feed, Decision Log) way down. We'll fix this by:

1. **Collapse all Vision sections into a single accordion** — one compact `<Accordion>` component with each vision section (Core Values, 10-Year Target, etc.) as a collapsible item. Closed by default. This shrinks Vision from ~6 full cards to a single row.

2. **Reorder the Strategy tab** — Put the action-oriented tools first:
   - Strategy Creator (top)
   - Leadership Review Feed
   - Decision Log
   - Vision accordion (bottom — reference material, not daily-use)
   - Quarterly Rocks (stays inside the Vision accordion as the last item)

## Files

| Action | File |
|--------|------|
| Edit | `src/pages/CeoDashboard.tsx` — Replace the Vision card-per-section layout with a single Accordion component, reorder sections so Strategy Creator / Review Feed / Decision Log come first, Vision accordion sits at the bottom |

No new components, no database changes, no edge function changes. Pure layout restructure within the Strategy `TabsContent`.

