

# Admin Settings, Roles & Content CRUD

## Overview
Add a role system (Admin/User), an admin settings page, and create/edit/delete capabilities for docs and databases. No auth context exists yet — everything needs to be built.

## What Gets Built

### 1. AuthContext (`src/contexts/AuthContext.tsx`)
- Stores `currentUser` (defaults to Sarah Chen) and `isAdmin` boolean
- Provides a `setRole` toggle for demo purposes (switch between Admin/User)
- `useAuth()` hook for consuming throughout the app

### 2. Settings Page (`src/pages/SettingsPage.tsx`, route `/settings`)
- **User Management tab**: List all team members, toggle their role between Admin/User
- **Workspace tab**: Edit workspace name and description
- Admin-only access — redirects or shows "Access Denied" for non-admins

### 3. Doc CRUD in DocsPage
- Lift `docPages` from static import into `useState` so mutations work
- "New Page" button (admin only) → dialog with title, content (textarea), tags, parent page selector
- Edit/Delete buttons on selected doc header (admin only)
- Reuse a `DocEditor` dialog component for both create and edit

### 4. Database CRUD
- "New Database" button already exists via `CreateDatabaseDialog` — gate behind admin role
- Add/edit/delete rows — gate edit/delete behind admin role
- Add database deletion (admin only) from the database list

### 5. Sidebar & Routing
- Add "Settings" gear icon link (admin only) to sidebar
- Add `/settings` route to App.tsx
- Wrap app with `AuthProvider`
- Add a small role toggle in sidebar footer for demo switching

## New Files
- `src/contexts/AuthContext.tsx`
- `src/pages/SettingsPage.tsx`
- `src/components/DocEditor.tsx`

## Modified Files
- `src/App.tsx` — AuthProvider wrapper, /settings route
- `src/components/AppSidebar.tsx` — Settings link, role toggle in footer
- `src/pages/DocsPage.tsx` — useState for docs, CRUD buttons + DocEditor
- `src/pages/DatabasesPage.tsx` — admin gates on create/edit/delete
- `src/lib/mock-data.ts` — add `role` field ("admin" | "user") to TeamMember

## Build Order
1. AuthContext + mock-data role field
2. Settings page + route
3. DocEditor + DocsPage CRUD
4. Database admin gates
5. Sidebar updates

