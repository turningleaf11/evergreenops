

# CEO Strategy Page Overhaul

## Summary

Three changes: (1) Scratch pad gains image paste/attach with AI OCR, (2) CEO Briefing becomes configurable — pull KPIs from internal databases + GoHighLevel CRM, (3) Remove Strategic Tensions, reorganize page into tabs, clean up fake data.

## 1. Scratch Pad Image Support

**What changes**: Add a paperclip/image button and support paste/drop of images. Images upload to the `files` storage bucket. The AI triage edge function already uses a vision-capable model (Gemini). We send image URLs alongside the text content so the AI can read handwritten notes.

- **ScratchPad.tsx**: Add an "attach image" button. Support `onPaste` and `onDrop` for images. Show inline image thumbnails below the textarea. Store image URLs in component state and include them in the `onProcess` callback.
- **ceo-triage edge function**: Accept an `images` array of URLs. Include them as image content parts in the AI request so Gemini can OCR handwritten notes.

## 2. CEO Briefing — Configurable KPIs

### GHL Integration
GoHighLevel doesn't have a pre-built connector. We'll need the user's GHL API key to pull pipeline/opportunity data.

- **Secret**: Request GHL API key via `add_secret` tool
- **New edge function `ceo-briefing-sync`**: Fetches opportunity/pipeline data from GHL's API (`/opportunities/search`), aggregates KPIs (e.g. pipeline value, deals by stage, calls made, leads added), and returns them
- **Configurable KPI cards**: The briefing section lets the admin pick which KPIs to show — both from GHL and from internal databases

### Internal Database KPIs
- Add a settings/config UI within the briefing section (gear icon) where the admin can:
  - Select which internal databases to pull summary counts from (e.g. "Deals" database → count by status column)
  - Toggle GHL KPIs on/off
- Store this config in a new `ceo_briefing_config` table (or a JSON column on workspaces)

### Remove fake data
- Strip all hardcoded values from `ceo-context.ts` (pipeline snapshot, risks, leverage, decisions needed) — replace with empty defaults
- CeoBriefing component will pull real data from the edge function + internal databases instead of from the CEO context

## 3. Remove Strategic Tensions + Reorganize into Tabs

**Remove**: Delete `StrategicTensions` component, remove from imports/render in CeoDashboard, clean references from `ceo-context.ts`.

**Tab layout** for the CEO Strategy page:

| Tab | Contents |
|-----|----------|
| **Brain Dump** | Scratch Pad (with images) + AI Triage results |
| **Delegation** | Delegation Board (by person / by status) |
| **Command** | CEO Briefing (configurable KPIs), Top Priorities, Morning Reset |
| **Strategy** | Vision, Strategy Creator, Review Feed, Decision Log |

Current Objective stays pinned above the tabs.

## Database

- **Migration**: Create `ceo_briefing_config` table (`id`, `user_id`, `config` jsonb, `updated_at`) with admin RLS
- Config JSON shape: `{ ghl_enabled: boolean, database_ids: string[], ghl_kpis: string[] }`

## Edge Functions

- **New `ceo-briefing-sync`**: Calls GHL API with user's API key, queries selected internal databases, returns aggregated KPI data
- **Update `ceo-triage`**: Accept `images` array, send as multimodal content to Gemini

## Files

| Action | File |
|--------|------|
| Migration | Create `ceo_briefing_config` table |
| Edit | `src/components/ScratchPad.tsx` — add image paste/drop/attach, thumbnail previews |
| Edit | `supabase/functions/ceo-triage/index.ts` — accept images, send multimodal to AI |
| New | `supabase/functions/ceo-briefing-sync/index.ts` — GHL API + internal DB KPI aggregation |
| Rewrite | `src/components/CeoBriefing.tsx` — configurable KPI cards, gear icon for settings, fetch from edge function + databases |
| Edit | `src/pages/CeoDashboard.tsx` — tab layout, remove Strategic Tensions |
| Edit | `src/lib/ceo-context.ts` — remove fake data defaults, remove strategicTensions type/methods |
| Delete | `src/components/StrategicTensions.tsx` |

## GHL API Key

Before implementing, I'll need to request your GoHighLevel API key. You can generate one in GHL under Settings > Business Profile > API Keys (or Settings > Company > API). I'll store it securely as a backend secret — it never touches the frontend.

## Sequence

1. Ask for GHL API key via secret tool
2. Run migration for `ceo_briefing_config`
3. Build all components and edge functions
4. Deploy

