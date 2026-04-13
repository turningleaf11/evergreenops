

# People Page Transformation + Runtime Error Fix

## Runtime Error (fix first)
The `GlobalCompanion` component renders outside `CompanionProvider` on non-Layout routes (login/signup/NotFound). The error "useCompanion must be used within CompanionProvider" fires when the component tree fails. Looking at Layout.tsx, the provider IS wrapping GlobalCompanion — so this may be a hot-reload artifact, but to be safe, add a guard in `GlobalCompanion.tsx` that returns null if the context is missing instead of throwing.

## People Page Redesign

### Database changes
Add new columns to `profiles` table:
- `title` (text, nullable) — job title/position
- `phone` (text, nullable) — contact number  
- `email` (text, nullable) — display email
- `bio` (text, nullable) — short about
- `reports_to` (uuid, nullable) — references profiles.user_id for org chart hierarchy

### People Page — three views via tabs

**1. Directory (everyone sees)**
- Card grid with photo/avatar, name, title, department, email, phone
- Search + department filter (already exists, enhance cards)
- Click a card to open a detail sheet showing full profile info

**2. Org Chart (everyone sees)**
- Tree visualization using `reports_to` field
- CEO/top-level at root, departments branch down
- Simple nested card layout (no external lib needed — recursive component)

**3. Team Management (admin only tab)**
- Per-person expandable rows with:
  - Onboarding checklist/status tracking
  - 1-on-1 notes (stored in a new `team_notes` table)
  - Growth track / development notes
- Admin can edit any profile inline (title, department, reports_to)

### New table: `team_notes`
```sql
create table public.team_notes (
  id uuid primary key default gen_random_uuid(),
  subject_user_id uuid not null, -- the person the note is about
  author_id uuid not null,
  type text not null default 'one_on_one', -- one_on_one, growth, general
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```
RLS: admins can CRUD all; authenticated users can read notes about themselves.

### Settings > Users & Roles
Already has invite, role change, department assignment — no changes needed there per the request. The People page becomes the rich directory/management view; Settings stays the admin control panel.

## Files changed

| What | File |
|------|------|
| Guard against missing context | Edit: `src/components/GlobalCompanion.tsx` |
| Add profile columns + team_notes table | Migration SQL |
| Rebuild People page with 3 tabs | Edit: `src/pages/PeoplePage.tsx` |
| New org chart component | New: `src/components/OrgChart.tsx` |
| New team management component | New: `src/components/TeamManagement.tsx` |
| New person detail sheet | New: `src/components/PersonDetail.tsx` |

