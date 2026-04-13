

# Protect Primary Admin & Restore Your Role

## Problem
You changed your own role to "user" in the Settings page and now can't access Settings to revert it. There's no protection preventing the primary admin from demoting themselves.

## Solution

1. **Database migration**: Restore your admin role and add a protection mechanism
   - Update your `user_roles` row back to `admin`
   - Add a `is_primary` boolean column to `user_roles` to flag the workspace creator
   - Mark your role as `is_primary = true`

2. **UI guard in SettingsPage**: In the Users tab, disable the role selector for the primary admin (yourself) so it can't be changed
   - Show a tooltip or badge saying "Primary Admin" instead of a dropdown
   - Still allow changing roles for all other users

3. **Database-level protection**: Add a trigger that prevents deleting or downgrading the primary admin's role
   - `BEFORE UPDATE OR DELETE ON user_roles` — reject if `is_primary = true` and the change would remove admin

## Files Changed
| File | Change |
|------|--------|
| Migration SQL | Restore admin role, add `is_primary` column, add protection trigger |
| `src/pages/SettingsPage.tsx` | Disable role selector when `is_primary` is true |
| `src/integrations/supabase/types.ts` | Auto-updated |

