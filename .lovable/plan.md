

# Fix Role-Based Visibility + People Detail Issues

## Problems Found

1. **Home page shows all departments**: `Index.tsx` uses `useDepartments()` unfiltered — regular users see every department card and can click into any of them.

2. **Department page has no access guard**: `DepartmentPage.tsx` doesn't check if the user belongs to that department. Anyone can navigate to `/department/:id` directly.

3. **Leadership tab visible to everyone**: The "Leadership" tab in `DepartmentPage.tsx` (line 317) renders unconditionally — no admin/role check.

4. **Home page shows all docs**: `Index.tsx` fetches all documents without filtering by department or visibility.

5. **Person detail shows empty**: When a new invited user's profile has null `email`, `phone`, `bio`, and `title`, all the conditional renders (`{person.email && ...}`) show nothing. The sheet opens but appears blank because there's no fallback content.

## Plan

### 1. Home page — filter departments + docs for regular users
In `src/pages/Index.tsx`:
- Import `useAuth` and get `isAdmin`, `profile`
- Filter `departments` the same way the sidebar does: admins see all, users see only their assigned department
- Filter `recentDocs` by visibility/shared_with logic, or for simplicity only show docs for the user's department

### 2. Department page — access guard + hide Leadership tab
In `src/pages/DepartmentPage.tsx`:
- Import `useAuth`, get `isAdmin`, `profile`
- If not admin and `profile.department_id !== id`, show an "Access denied" or redirect
- Conditionally render the Leadership tab only for admins:
  ```tsx
  {isAdmin && <TabsTrigger value="leadership">Leadership</TabsTrigger>}
  ```
  And wrap the `TabsContent` for leadership similarly

### 3. Person detail — show fallback when fields are empty
In `src/components/PersonDetail.tsx`:
- Always show the "Details" section header
- For empty fields, show placeholder text like "No email on file" instead of hiding the row entirely
- Show the user's auth email from the profiles table as a fallback if `person.email` is null
- Ensure the "About" section shows "No bio added yet" when empty

### 4. Docs page — filter by visibility (if not already)
Quick check if `DocsPage.tsx` already filters documents by department/visibility for non-admin users. If not, apply similar filtering.

## Files changed

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Filter departments + docs by user role/department |
| `src/pages/DepartmentPage.tsx` | Add access guard; hide Leadership tab for non-admins |
| `src/components/PersonDetail.tsx` | Show fallback content for empty profile fields |
| `src/pages/DocsPage.tsx` | Filter docs visibility for non-admin users (if needed) |

