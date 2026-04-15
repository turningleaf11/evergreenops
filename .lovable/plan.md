

# Premium SaaS UI Design System Overhaul

## What's Wrong Now
The app looks flat and basic — the sidebar tinting was the only visible change. Cards lack depth, spacing is tight, typography hierarchy is weak, and there's no sense of premium polish. The screenshot confirms it: everything blends together with no clear surface separation.

## Design Direction
Modern SaaS with soft depth (think Linear, Notion, Vercel Dashboard): neutral base, controlled accent, layered surfaces, generous spacing, clear hierarchy. No playful colors — premium internal tool feel.

## Changes

### 1. Color tokens — better surface separation (`src/index.css`)
- **Light mode**: Background `220 20% 96%` (slightly cooler), card stays pure white `0 0% 100%`
- **Dark mode**: Background `224 24% 4%`, card `224 20% 7%` — more contrast between page and cards
- **Sidebar**: Revert to neutral tones (remove accent tinting) — light: `220 16% 98%`, dark: `224 22% 5.5%`. Clean, slightly lighter than content area
- **Borders**: Softer in light (`220 14% 92%`), more visible in dark (`220 12% 16%`)
- **Muted foreground**: `220 10% 46%` light, `220 10% 50%` dark — better readability

### 2. Remove accent-tinted sidebar (`src/contexts/WorkspaceContext.tsx`)
Remove the sidebar-background/foreground/border overrides from `applyAccentColor()`. The sidebar should stay neutral — only `--primary`, `--ring`, and `--sidebar-primary` should change with accent color.

### 3. Card component upgrade (`src/components/ui/card.tsx`)
- Increase border-radius to `rounded-2xl` (already done, keep it)
- Use `bg-card` with `shadow-sm` default, `border-border/40`
- Add `data-slot="card"` already handled in CSS

### 4. Enhanced card CSS depth system (`src/index.css`)
- Light cards: soft multi-layer shadow + top 1px white highlight (`box-shadow: inset 0 1px 0 rgba(255,255,255,0.7)`)
- Dark cards: inner glow top edge, subtle border bump
- Hover: gentle shadow increase, NO transform (transform causes layout jank)
- Remove `transform` from card hover transitions

### 5. Typography hierarchy (`src/index.css`)
Add base typography utilities:
- `.page-title`: `text-2xl font-bold tracking-tight` (currently `text-2xl font-semibold`)
- `.section-title`: `text-base font-semibold text-foreground`
- Update `h1` base to `font-bold` (from `font-semibold`)

### 6. Spacing & layout improvements (`src/pages/Index.tsx`)
- Increase page padding from `p-6` to `p-8`
- Increase section gap from `space-y-8` to `space-y-10`
- Department cards grid gap from `gap-3` to `gap-4`
- Bottom section grid gap from `gap-6` to `gap-6` (keep)
- Welcome title: `text-3xl font-bold` (from `text-2xl font-semibold`)
- Subtitle: `text-base` (from `text-sm`)

### 7. Sidebar polish (`src/components/AppSidebar.tsx`)
- Remove the accent tinting visual effect
- Active item: keep the `nav-active-indicator` left bar + `bg-primary/8` pill (softer than 10%)
- Hover: `hover:bg-muted/60` (softer)
- Header logo: slightly larger `h-8 w-8`, cleaner spacing

### 8. Button refinements (`src/components/ui/button.tsx`)
- Default: add `shadow-sm` (already has it, keep)
- Outline: add `shadow-xs` for subtle depth
- Ghost: no change
- All: ensure `rounded-xl` (bump from `rounded-lg`)

### 9. Badge softening (`src/components/ui/badge.tsx`)
- Default variant: `bg-primary/10 text-primary border-primary/20` (soft background, not solid)
- Keep destructive solid
- Add `font-medium` (from `font-semibold`) for less visual weight

### 10. Input refinement (`src/components/ui/input.tsx`)
- Add `shadow-xs` for subtle inset feel
- Ensure `rounded-xl` consistency

### 11. Header bar (`src/components/Layout.tsx`)
- Make header `bg-card/80 backdrop-blur-sm` for subtle glass effect
- Border: `border-border/30` (softer)

### 12. Active nav indicator CSS (`src/index.css`)
- Keep the left bar indicator
- Soften: height `50%`, width `2.5px`, slight rounded

## Files

| Action | File |
|--------|------|
| Edit | `src/index.css` — Token refinements, card depth, typography utilities |
| Edit | `src/contexts/WorkspaceContext.tsx` — Remove sidebar tinting from applyAccentColor |
| Edit | `src/components/ui/card.tsx` — Border/shadow class tweaks |
| Edit | `src/components/ui/button.tsx` — Rounded-xl, shadow consistency |
| Edit | `src/components/ui/badge.tsx` — Softer default variant |
| Edit | `src/components/ui/input.tsx` — Shadow-xs, rounded-xl |
| Edit | `src/components/Layout.tsx` — Header glass effect |
| Edit | `src/components/AppSidebar.tsx` — Softer hover/active states |
| Edit | `src/pages/Index.tsx` — Spacing, typography hierarchy |

No migrations needed.

