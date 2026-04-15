

# Comprehensive Plan — Strategy Simplification, Leadership Cleanup, Fixes, Add-Ons, Intranet Features

## Phase 1: Fixes & Cleanup

### 1A. Remove Execution Snapshot & Simplify Leadership Tab
- **Delete** `src/components/ExecutionSnapshot.tsx`
- **Refactor** `src/pages/LeadershipDashboard.tsx`:
  - Remove Tabs (Execution Mode / Think + Improve) — single scrollable page
  - Layout: Strategy Feed → Action Required (renamed from "Translation Required") → Promote Upward
  - Keep Leadership AI button in header
  - Remove all ExecutionSnapshot references
- **Update** `src/components/DepartmentPage.tsx` if it references ExecutionSnapshot

### 1B. Fix Double Status on Goals
- `src/pages/ExecutionPage.tsx`: Remove duplicate `StatusBadge`, keep only the `Select` dropdown styled with status color

### 1C. Fix Notes Folder Persistence
- **Migration**: Create `note_folders` table (id, name, user_id, workspace_id, created_at)
- **RLS**: Users can CRUD their own folders
- Update `src/pages/NotesPage.tsx` to persist folders to DB instead of local state only

### 1D. Strategy Flow UX Simplification
- Rename "Translation Required" → "Action Required" or "Needs Your Response"
- Make the response flow simpler: Acknowledge button + optional Department Notes field (free text)
- Remove rigid "What this means" / "What changes immediately" structure — replace with a single optional notes area
- Add friendly helper text explaining the purpose: "Review this directive from leadership and acknowledge when your team is aligned"

## Phase 2: Add-On Packs Infrastructure

### 2A. Seed Add-On Catalog & Stripe Readiness
- **Migration**: Add `price_tier` column to `addon_packs` if not present (values: 'free', 'paid')
- Add `stripe_price_id` column (nullable) for future Stripe integration
- Seed two packs: "Time Clock" (free) and "Real Estate Market Research" (paid)
- Update Settings → Add-Ons UI to show price tier badges and a "Coming Soon" payment indicator for paid packs

### 2B. Time Clock Add-On
- **New tables**: `time_entries` (user_id, clock_in, clock_out, is_manual, notes), `time_off_requests` (user_id, start_date, end_date, type, status, approved_by)
- **New page**: `src/pages/TimeClockPage.tsx` — Punch In/Out button, weekly timesheet grid, manual entry form (flagged as "Manual"), time-off request form
- **Sidebar**: Conditionally rendered via `useAddonEnabled('time-clock')`
- **RLS**: Users see own entries; admins see all in workspace

### 2C. Real Estate Market Research Add-On
- **New page**: `src/pages/MarketResearchPage.tsx` — Input markets (city/zip), investment strategy, trigger AI analysis
- **New table**: `market_research` (id, workspace_id, market_name, strategy, ai_analysis JSONB, created_at)
- **Edge Function**: `market-research` — Takes market + strategy, uses Lovable AI (Gemini 2.5 Pro) to analyze job growth, industries, population trends, rental demand, and recommend optimal strategy
- **Sidebar**: Gated behind `useAddonEnabled('real-estate-research')`

## Phase 3: Core Intranet Features

### 3A. Team Polls & Surveys
- **New tables**: `polls` (title, options JSONB, created_by, department_id, expires_at), `poll_votes` (poll_id, user_id, option_index)
- **New component**: `src/components/TeamPolls.tsx` — Create poll, vote, see results
- Accessible from department hubs or a dedicated nav item

### 3B. Announcements / News Feed
- **New table**: `announcements` (title, content, author_id, pinned, department_id nullable for company-wide, created_at)
- **New component**: `src/components/AnnouncementsFeed.tsx` — Pinned items at top, chronological feed
- Show on Home page and optionally in department hubs

### 3C. Team Kudos / Recognition
- **New table**: `kudos` (from_user_id, to_user_id, message, category, created_at)
- **New component**: `src/components/KudosWall.tsx` — Give kudos to teammates, public recognition feed
- Categories: "Great Work", "Team Player", "Innovation", "Leadership"

### 3D. Internal Forms / Requests
- **New tables**: `form_templates` (name, fields JSONB, department_id), `form_submissions` (template_id, submitted_by, values JSONB, status)
- **New page**: `src/pages/FormsPage.tsx` — Browse templates, submit forms, track status
- Pre-seed templates: PTO Request, IT Ticket, Procurement Request

### 3E. Employee Directory Enhancements
- **Migration**: Add `skills` (text[]), `timezone`, `availability_status` columns to profiles
- Update `src/pages/PeoplePage.tsx` to display and filter by skills, timezone, availability

## Phase 4: Reminders Multi-Delegation
- Already has migration for `reminder_assignees` junction table
- Update `RemindersWidget.tsx` with multi-select people picker
- Update reminder queries to include junction table assignees

## Phase 5: Mobile Optimization
- Responsive padding and grid adjustments across Layout, Index, ExecutionPage, and all new pages
- Safe-area-inset padding on Layout
- Single-column stacking on small screens

---

## Files Summary

| Action | Target |
|--------|--------|
| Delete | `src/components/ExecutionSnapshot.tsx` |
| Edit | `src/pages/LeadershipDashboard.tsx` — Remove tabs, single-page layout |
| Edit | `src/pages/ExecutionPage.tsx` — Remove duplicate StatusBadge |
| Edit | `src/pages/NotesPage.tsx` — Persist folders to DB |
| Edit | `src/components/TranslationBlock.tsx` — Simplify response flow |
| Edit | `src/pages/SettingsPage.tsx` — Price tier badges on add-ons |
| Edit | `src/components/RemindersWidget.tsx` — Multi-select delegation |
| Edit | `src/pages/PeoplePage.tsx` — Skills, timezone, availability |
| Edit | `src/components/Layout.tsx` — Mobile safe-area |
| Edit | `src/pages/Index.tsx` — Mobile responsive |
| New | `src/pages/TimeClockPage.tsx` |
| New | `src/pages/MarketResearchPage.tsx` |
| New | `src/pages/FormsPage.tsx` |
| New | `src/components/TeamPolls.tsx` |
| New | `src/components/AnnouncementsFeed.tsx` |
| New | `src/components/KudosWall.tsx` |
| New | `supabase/functions/market-research/index.ts` |
| Migrations | note_folders, time_entries, time_off_requests, market_research, polls, poll_votes, announcements, kudos, form_templates, form_submissions, profiles columns |

