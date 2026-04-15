

# Scrap Crystal, Elevate Standard with Arc-Inspired Polish

## Why Crystal Failed
Crystal tried to differentiate through glassmorphism alone — translucent backgrounds and blurs. But the underlying layout, spacing, shadows, and color usage stayed the same, so it looked nearly identical. The real issue is that Standard itself needs more personality.

## What Arc Does Well
Arc's aesthetic is about **colorful confidence**: the sidebar has a tinted, saturated background that follows your chosen accent color. Cards have real depth with layered shadows. Surfaces feel distinct from each other. There's warmth and personality without being unprofessional.

## The Plan

### 1. Remove Crystal entirely
- Delete all `.style-crystal` CSS blocks from `src/index.css` (~200 lines)
- Remove `appStyle` state, class toggle, and DB persist from `src/contexts/WorkspaceContext.tsx`
- Remove the App Style picker card from `src/pages/SettingsPage.tsx`
- Remove `data-content="main"` from `src/components/Layout.tsx` (no longer needed)
- Remove `data-peek-surface` / `data-peek-title` / `data-peek-body` attributes from `src/components/DetailDrawer.tsx` (only existed for Crystal)

### 2. Accent-tinted sidebar (Arc's signature move)
Currently the sidebar uses flat `--sidebar-background` (a neutral gray). Change the accent color system so the sidebar background gets a **subtle tint of the workspace accent color**:
- Light: `hsl(accent-hue, 20%, 95%)` — just enough color to feel intentional
- Dark: `hsl(accent-hue, 18%, 10%)` — deep tinted surface
- Active nav item gets a stronger accent pill (like Arc's tab highlighting)
- Update `applyAccentColor()` in WorkspaceContext to set these sidebar variables dynamically

### 3. Better card depth and surface hierarchy
Replace the current flat cards with a more layered system:
- **Cards**: Slightly stronger shadow (`0 2px 8px -2px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)`), subtle border, and a 1px top highlight in light mode
- **Dark mode cards**: Lighter border (`border: 1px solid hsl(220, 14%, 18%)`), faint inner glow
- **Hover states**: Cards lift slightly on hover with shadow increase (`transition: box-shadow 0.2s, transform 0.2s`)
- Update `shadow-card` utility and card component defaults in `src/index.css`

### 4. Warmer, more alive color tokens
Refine the base palette slightly:
- **Light mode background**: Shift from pure warm gray (`36 25% 97%`) to a very slight accent-tinted white — makes the whole app feel cohesive
- **Dark mode**: Deepen the background slightly (`224 22% 5%`) for more contrast with cards
- **Muted foreground**: Bump from 46% to 42% lightness for slightly better readability
- **Border**: Make borders slightly more visible in dark mode (`220 14% 18%`)

### 5. Active nav item polish
The current active state (`bg-sidebar-accent`) is barely visible. Make it:
- A **pill shape** with the accent color at 12% opacity, rounded-lg
- **Left edge indicator**: 3px accent-colored bar on the active item
- Slightly bolder text weight on active

## Files

| Action | File |
|--------|------|
| Edit | `src/index.css` — Remove all Crystal CSS, improve card shadows, refine color tokens |
| Edit | `src/contexts/WorkspaceContext.tsx` — Remove appStyle, enhance accent color to tint sidebar |
| Edit | `src/pages/SettingsPage.tsx` — Remove App Style picker section |
| Edit | `src/components/Layout.tsx` — Remove data-content attribute |
| Edit | `src/components/DetailDrawer.tsx` — Remove peek data attributes |
| Edit | `src/components/AppSidebar.tsx` — Active nav item left indicator styling |
| Edit | `src/components/NavLink.tsx` — Updated active class for pill + indicator |

No migration needed — the `app_style` column can stay in DB harmlessly.

