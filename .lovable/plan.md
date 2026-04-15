

# Fix Crystal Mode: Frosted Content Layer + Balanced Gradient

## Problem
The main content area (`<main>`) has no background in Crystal mode. The animated gradient mesh shows through raw, tinting everything with a muddy green/yellow wash. Rows using `bg-muted/20` offer no real opacity barrier.

## Fix

### 1. Add glass treatment to the main content area (`src/index.css`)
Add a Crystal-scoped rule for the main content zone:
- `background: rgba(255, 255, 255, 0.55)` (light) / `rgba(10, 10, 20, 0.6)` (dark)
- `backdrop-filter: blur(32px)` — heavier blur so the gradient becomes a soft ambient glow rather than visible blobs
- This creates a frosted pane that the gradient shows *through* subtly, not directly

Target: `.style-crystal main` or `.style-crystal [data-content="main"]` (add a data attribute to Layout's `<main>`)

### 2. Reduce gradient mesh intensity (`src/index.css`)
- Drop light mode blob opacities from 15-28% to 10-18%
- Drop dark mode from 12-20% to 8-14%
- The gradient should be ambient atmosphere, not the dominant visual

### 3. Fix row backgrounds for Crystal (`src/index.css`)
Add Crystal-scoped overrides for the group containers and rows:
- Group container (`bg-muted/20`): override to `rgba(255,255,255,0.3)` with a light border
- Row items (`bg-muted/30`): override to `rgba(255,255,255,0.4)` with subtle `backdrop-filter: blur(8px)`
- This gives rows their own frosted layer on top of the content pane

### 4. Layout data attribute (`src/components/Layout.tsx`)
Add `data-content="main"` to the `<main>` tag so CSS can target it without broad selectors.

## Files

| Action | File |
|--------|------|
| Edit | `src/index.css` — Reduce gradient, add main content glass, add row glass overrides |
| Edit | `src/components/Layout.tsx` — Add data attribute to `<main>` |

