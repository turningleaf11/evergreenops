

# Fix Notes, Standardize Docs, Lists Button, Quick Actions, Hex Colors, More Icons

## 1. Fix Notes Not Switching Content

**Problem**: The `RichTextEditor` uses TipTap's `useEditor` which only reads `content` on initial mount. Clicking a different note updates React state but the editor keeps showing the old content.

**Fix**: Add `key={selectedId}` to the `RichTextEditor` in `NotesPage.tsx` so React remounts the editor when switching notes. This is the same pattern Docs uses (`key={selected.id}` on `InlineDocEditor`).

## 2. Standardize Docs Editor — Remove Border Box

**Problem**: Docs uses `<RichTextEditor>` without `borderless` prop, so it renders with `border rounded-lg`. Notes uses `borderless` which looks cleaner.

**Fix**: Pass `borderless` to the `RichTextEditor` in the `InlineDocEditor` component inside `DocsPage.tsx` (line 376).

## 3. Rename "New Database" Button to "New List"

One-line text change in `DatabasesPage.tsx` line 218.

## 4. Quick Actions Dropdown on Department Pages

Add a "Quick Actions" dropdown button in the department page header (next to the tabs). It pulls from the existing `department_pinboard` table (which already stores links). Renders as a dropdown menu with external link items — each opens in a new tab. Admins can add/remove items via the existing pinboard management UI already on the page.

No database changes needed — reuses `department_pinboard`.

## 5. Custom Color — Hex Input Instead of HSL Hue

Replace the HSL hue number input in `AccentColorPicker` with a hex color input (`#RRGGBB`). When the user enters a hex value, convert it to HSL hue and apply via `setAccentColor`. Show the hex value as the primary input format.

## 6. Add Missing Department Icons

Add to `icon-map.ts`: `Handshake`, `Search`, `Building`, `TreePine`, `Wallet` (money bag equivalent), `Pencil`. Lucide has all of these.

## 7. Fix Runtime Error — useWorkspace outside WorkspaceProvider

The `CeoDashboard` crashes because it calls `useWorkspace()` but may render outside the provider. Need to check the provider tree in `App.tsx` and ensure `WorkspaceProvider` wraps the CEO route.

## Files

| Action | File |
|--------|------|
| Edit | `src/pages/NotesPage.tsx` — Add `key={selectedId}` to RichTextEditor |
| Edit | `src/pages/DocsPage.tsx` — Add `borderless` prop to RichTextEditor in InlineDocEditor |
| Edit | `src/pages/DatabasesPage.tsx` — Change "New Database" to "New List" |
| Edit | `src/pages/DepartmentPage.tsx` — Add Quick Actions dropdown in header using pinboard links |
| Edit | `src/pages/SettingsPage.tsx` — Replace HSL hue input with hex color input + conversion |
| Edit | `src/lib/icon-map.ts` — Add Handshake, Search, Building, TreePine, Wallet, Pencil icons |
| Edit | `src/App.tsx` — Verify WorkspaceProvider wrapping (fix runtime error) |

No database changes needed.

