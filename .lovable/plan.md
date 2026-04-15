

# Crystal Mode Overhaul: Bold Glassmorphism with Energy

The current Crystal mode is too subtle — the gradient blobs are at 6-12% opacity and the glass barely differs from Standard. This overhaul makes Crystal feel like a distinctly premium, modern workspace aesthetic.

## What Changes

### 1. Animated gradient mesh background (`src/index.css`)
Replace the static, barely-visible gradient with a bold, slowly-animating mesh:
- **3-4 large gradient blobs** at 25-35% opacity (light) / 15-25% opacity (dark), using the accent hue
- **Slow 20s CSS animation** (`@keyframes mesh-drift`) that gently shifts blob positions — creates a living, breathing feel without being distracting
- Blobs use the `--primary` CSS variable so they follow the workspace accent color

### 2. Aggressive glass surfaces (`src/index.css`)
- **Cards**: Drop to `bg-white/45` (light) / `bg-white/[0.04]` (dark), add `border: 1px solid rgba(255,255,255,0.18)` top-edge highlight, increase blur to `blur(24px)`, add a subtle inner glow via `box-shadow: inset 0 1px 0 rgba(255,255,255,0.12)`
- **Sidebar**: `bg-white/35` with `blur(28px)`, frosted left edge highlight
- **Header**: `bg-white/40` with `blur(20px)`, bottom border goes to `rgba(255,255,255,0.1)`
- **Popovers/Dialogs**: Stronger blur (24px), lower opacity backgrounds
- **Inputs in Crystal mode**: Slightly transparent backgrounds so they feel part of the glass

### 3. Crystal-specific color token overrides (`src/index.css`)
When `.style-crystal` is active, override some CSS variables:
- `--border` gets lighter/more transparent
- `--card` shifts slightly toward the accent hue for a tinted glass effect
- `--sidebar-border` becomes near-invisible
- Add a `--glass-highlight: 0 0% 100%` variable for the white edge highlights

### 4. Dark mode Crystal gets extra love
- Gradient blobs use a slightly different palette (blue-violet shift) for depth
- Cards get a faint colored border glow (`box-shadow: 0 0 0 1px hsl(var(--primary) / 0.1)`)
- Sidebar gets a subtle accent-tinted left border strip

### 5. No component file changes needed
All overrides are pure CSS scoped to `.style-crystal` — the existing class toggle in WorkspaceContext handles everything.

## Files

| Action | File |
|--------|------|
| Edit | `src/index.css` — Replace Crystal section with bold glassmorphism + animated mesh |

Single file change. No migration, no component edits.

