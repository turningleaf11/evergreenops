

# Unified People Directory — Merge Team Management into Detail Sheet

## Problem
The current People page has three disconnected tabs. The Team Management tab is a separate collapsible list that duplicates what the Directory already shows. The PersonDetail sheet is nearly empty (just name, department, contact). There's no photo upload anywhere. The user wants one unified flow: click a person in the Directory, open a rich detail sheet that shows profile info for everyone AND admin-only management features (notes, profile editing) inline.

## What changes

### 1. Remove Team Management tab
Delete the separate "Team Management" tab from `PeoplePage.tsx`. The page keeps only **Directory** and **Org Chart** tabs.

### 2. Rebuild PersonDetail sheet as the single detail view
Merge all TeamManagement functionality (profile editing, 1-on-1/growth/general notes) into the `PersonDetail` sheet component:

- **Everyone sees**: Avatar (with upload button for admins), name, title, department badge, bio, email, phone, reports-to
- **Admin-only section** (shown below profile info):
  - "Edit" button to toggle inline profile editing (title, department, reports_to, email, phone, bio) — same fields currently in TeamManagement
  - Notes section with 1-on-1 / Growth / General tabs — moved from TeamManagement
  - Avatar/photo upload button on the avatar itself

### 3. Photo upload
- Add a camera/upload overlay on the avatar in the detail sheet (admin only, or the user viewing their own profile)
- Use existing `uploadFile` from `src/lib/file-upload.ts` to upload to the `files` bucket
- Save the public URL to `profiles.avatar_url`
- Show actual avatar image when `avatar_url` is set (use `AvatarImage`)

### 4. Directory cards show avatar photos
Update the directory card grid to render `AvatarImage` when `avatar_url` exists.

### 5. Invite flow — already wired
The Settings invite dialog already collects role, department, and name. The edge function already sets `department_id` and role on the new user's profile. When they appear in the directory, those details will show. No changes needed here — it's already working.

## Files changed

| What | File |
|------|------|
| Remove Team Management tab, keep Directory + Org Chart only | Edit: `src/pages/PeoplePage.tsx` |
| Rebuild with admin editing, notes, photo upload | Edit: `src/components/PersonDetail.tsx` |
| Show avatar images in directory cards + org chart | Edit: `src/pages/PeoplePage.tsx`, `src/components/OrgChart.tsx` |
| No longer needed as standalone | Delete: `src/components/TeamManagement.tsx` |

No database changes needed — `avatar_url` column and `team_notes` table already exist.

