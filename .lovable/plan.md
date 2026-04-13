

# Admin Training & Onboarding Editor

## Problem
Training modules and onboarding steps are hardcoded in `src/lib/training-data.ts`. Admins have no way to create, edit, or delete training content through the UI.

## Solution
Add a **Training** management tab to the existing Settings page (admin-only), plus move training data into a React context with localStorage persistence — same pattern used for departments and workspace settings.

## What Gets Built

### 1. Training Context (`src/contexts/TrainingContext.tsx`)
- Wraps training modules + onboarding steps in reactive state
- Seeds from current `training-data.ts` defaults on first load
- Persists to localStorage
- Exposes CRUD: `addModule`, `updateModule`, `deleteModule`, `addOnboardingStep`, `updateOnboardingStep`, `deleteOnboardingStep`

### 2. Settings → Training Tab (`src/pages/SettingsPage.tsx`)
- New **"Training"** tab alongside Workspace, Departments, Users & Roles
- **Onboarding Steps** section: reorderable list with inline edit (title, description, link), add/delete
- **Training Modules** section: list of modules with expandable editor for each
  - Edit title, description, type, category, role filter
  - Manage steps within each module (add/edit/delete step title, content, video URL, external link)
  - Delete entire module
- "Add Module" button at the bottom

### 3. Wire Training Page to Context
- `TrainingPage.tsx` reads from context instead of static import
- `OnboardingBanner` (if it exists) also reads from context

## Files

| File | Action |
|------|--------|
| `src/contexts/TrainingContext.tsx` | **Create** — Training data state + localStorage |
| `src/pages/SettingsPage.tsx` | **Edit** — Add Training tab with module/step editors |
| `src/pages/TrainingPage.tsx` | **Edit** — Read from context instead of static data |
| `src/App.tsx` | **Edit** — Wrap with TrainingProvider |
| `src/components/OnboardingBanner.tsx` | **Edit** — Read from context if applicable |

## Build Order
1. Create TrainingContext
2. Add Training tab to Settings with full CRUD UI
3. Update TrainingPage + OnboardingBanner to use context
4. Wrap app in provider

