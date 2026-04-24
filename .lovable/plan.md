
Fix the Settings page by separating its navigation from the shared tab-bar styling that is forcing the desktop layout to behave like a horizontal strip.

1. Replace the Settings page navigation architecture
- Refactor `src/pages/SettingsPage.tsx` so Settings uses a controlled `activeSection` state instead of relying on the current `TabsList`/`TabsTrigger` desktop layout.
- Keep the existing section grouping (`Workspace`, `People`, `Extensions`), but render them as a dedicated left sidebar on desktop:
  - fixed-width/sticky aside
  - grouped labels with dividers
  - full-width nav rows
  - active state matching the current workspace accent color
- On mobile, render a separate horizontal scroller above the content instead of trying to reuse the desktop sidebar markup.

2. Remove the layout conflict causing the current breakage
- Stop using the current `contents lg:block` structure inside the tab list.
- Avoid depending on shared `src/components/ui/tabs.tsx` styles for the desktop Settings sidebar, since those base styles are optimized for horizontal tab bars and are leaking into this page.
- Ensure the Settings sidebar container has proper width containment (`w-full`, fixed desktop width, `shrink-0`, `min-w-0` on content area) so nav items cannot spill into the main panel.

3. Keep content rendering exactly the same
- Preserve the existing Settings sections and functionality:
  - Workspace
  - Departments
  - Home Widgets
  - Holidays
  - Users & Roles
  - Training
  - Add-Ons
  - Forms
  - Integrations
- Only change how the section navigation is rendered and how the active panel is selected.
- Do not alter any data fetching, forms, dialogs, permissions, or business logic.

4. Tighten the desktop visual layout
- Wrap the left navigation in a clean panel/card so it reads as a true settings sidebar.
- Align the content area to start at the top of the first section.
- Make the active item more obvious with:
  - soft tinted background
  - stronger text/icon color
  - subtle inset/border treatment
- Keep inactive items visually quiet and evenly spaced.

5. Preserve mobile behavior cleanly
- Show a compact horizontal tab strip only below the desktop breakpoint.
- Keep it scrollable when needed.
- Ensure the desktop sidebar is hidden on mobile and the mobile strip is hidden on desktop so there is never duplicated navigation in the DOM causing overlap.

6. Validate the problem areas shown in the screenshots
- Confirm that items like `Departments`, `Home Widgets`, `Holidays`, `Training`, `Forms`, and `Integrations` no longer spill into the main content region.
- Confirm `Users & Roles` content starts in the correct column and the `Invite User` action aligns within the main panel instead of competing with the nav.
- Confirm loading states like `Loading users...` and `Loading add-ons...` render inside the content panel only.

Files to update
- `src/pages/SettingsPage.tsx` — main refactor for controlled settings navigation and responsive desktop/mobile layouts
- Possibly no global component changes unless a tiny utility class adjustment is truly necessary; prefer keeping the fix local to Settings so other tabbed pages are unaffected

Technical implementation notes
- Use a local `const [activeSection, setActiveSection] = useState(...)`.
- Render sidebar buttons from the existing `navSections` config.
- Render the active content panel with either:
  - conditional section rendering, or
  - controlled Radix `Tabs` value with custom non-Radix desktop nav
- Prefer a local, page-specific nav component pattern over further extending the global `TabsList` primitive, since the Settings page needs a sidebar pattern rather than a generic tab bar.
