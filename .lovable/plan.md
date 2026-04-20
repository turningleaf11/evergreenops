

## Cover Photo Picker — Gallery / Upload / Link / Unsplash

Replace the current single-button "Change cover" flow with a tabbed picker modeled after the screenshot. Opens from the existing `Change` button on the cover.

### Tabs

1. **Gallery** — curated presets bundled with the app
   - **Color & Gradient** section: ~12 solid colors + linear gradients rendered as CSS (no image upload required).
   - **Photos** section: ~12 curated stock images stored in `public/covers/` (or referenced by URL).
   - Click a tile → sets `cover_url` to either the image URL or a `gradient:<css>` token.
2. **Upload** — current file upload flow (drag & drop + click).
3. **Link** — paste any image URL, validates it loads, then saves as `cover_url`.
4. **Unsplash** — search input hitting Unsplash API; grid of results; click to set as `cover_url`. Requires `UNSPLASH_ACCESS_KEY` secret + a tiny edge function `unsplash-search` (keeps key server-side, returns thumb + full URLs + attribution).
5. **Remove** action stays in the top-right of the picker.

### Gradient/color rendering

`cover_url` currently only holds a URL. To support gradients without a new column, use a prefix convention:
- `gradient:linear-gradient(135deg, #ff6b6b, #f06595)` → renders via `background-image` directly.
- `color:#fef3e6` → renders as solid bg.
- Anything else → treated as image URL (current behavior).

`DocCover` reads the prefix and applies the right `style` (and disables Reposition when not an image).

### New / edited files

- **New** `src/components/docs/CoverPickerDialog.tsx` — tabbed dialog (Gallery / Upload / Link / Unsplash) + Remove button.
- **New** `src/lib/cover-presets.ts` — arrays of gradient/color tokens and curated photo URLs.
- **New** `supabase/functions/unsplash-search/index.ts` — proxies search to Unsplash, returns `{ id, thumb, full, author, authorUrl }[]`.
- **Edit** `src/components/docs/DocCover.tsx`:
  - Replace the three inline buttons (Reposition / Change / Remove) with: `Reposition` (only for images) + `Change` (opens picker) + Download icon.
  - Add prefix-aware rendering for `gradient:` / `color:` / image URL.
- No DB migration needed.

### Secret required

`UNSPLASH_ACCESS_KEY` (free dev key from unsplash.com/developers). I'll request it via add_secret before wiring the Unsplash tab; until then the Unsplash tab shows a "Connect Unsplash" empty state and the other 3 tabs work fully.

### Out of scope

- No changes to icon picker (already has Emoji + Upload tabs).
- Reposition only enabled for raster images, hidden for gradients/colors.

