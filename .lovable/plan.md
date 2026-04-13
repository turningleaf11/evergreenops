

# Onboarding & Training System

## Overview
Add a Training Hub page with role-based onboarding flows, training content, and lightweight progress tracking using localStorage. Also fix the existing React `useRef` runtime error (likely a duplicate React instance from the TipTap dependency chain).

## What Gets Built

### 1. Training Data Model (`src/lib/training-data.ts`)
- Types: `TrainingModule`, `TrainingStep`, `TrainingCategory`
- Each module has: id, title, description, type (guide | playbook | checklist | video | link), roleIds (which department roles see it), category, steps/content, externalUrl
- Seed data: Company-wide onboarding modules + role-specific training for each department
- Categories: "Onboarding", "Role Training", "Processes", "Tools"

### 2. Training Progress Context (`src/lib/training-progress.ts`)
- React context + localStorage persistence
- Tracks: `completedSteps: Record<moduleId, stepId[]>`, `onboardingDismissed: boolean`
- Helper functions: `markStepComplete`, `isModuleComplete`, `getModuleProgress`

### 3. Training Hub Page (`src/pages/TrainingPage.tsx`, route `/training`)
- Central page listing all training materials
- Filter by category (tabs) and role/department
- Each module shown as a card with progress indicator
- Click to expand/view module content inline (accordion or detail panel)
- Module detail shows steps with checkboxes, embedded content, video iframes, external links

### 4. Onboarding Banner (`src/components/OnboardingBanner.tsx`)
- Shows on the home page (Index) for users who haven't completed onboarding
- Welcome message, company overview, progress bar
- Steps: "Meet the team", "Explore your department", "Review key docs", "Complete role training"
- Dismissible, tracks completion via training progress context

### 5. Navigation & Routing
- Add `/training` route in `App.tsx`
- Add "Training" nav item in `AppSidebar.tsx` (visible to all users)
- Admins see an "Edit" toggle to manage content (add/edit modules inline)

### 6. Fix Runtime Error
- The `useRef` null error is a duplicate React issue from TipTap deps. Add a React alias in `vite.config.ts` to deduplicate.

## Files

| File | Action |
|------|--------|
| `src/lib/training-data.ts` | **Create** — Types + seed training/onboarding content |
| `src/lib/training-progress.ts` | **Create** — Progress context with localStorage |
| `src/pages/TrainingPage.tsx` | **Create** — Training hub page |
| `src/components/OnboardingBanner.tsx` | **Create** — Home page onboarding widget |
| `src/pages/Index.tsx` | **Edit** — Add OnboardingBanner |
| `src/App.tsx` | **Edit** — Add `/training` route, wrap with TrainingProgressProvider |
| `src/components/AppSidebar.tsx` | **Edit** — Add Training nav item |
| `vite.config.ts` | **Edit** — Add React alias to fix duplicate React |

## Build Order
1. Fix runtime error (vite.config.ts React alias)
2. Training data types + seed content
3. Training progress context
4. Training hub page
5. Onboarding banner component
6. Routing + sidebar updates

