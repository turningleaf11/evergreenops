

# Bug Fixes: Docs, Rich Text Editor, and Activity Sidebar

## Issues Identified

1. **Docs: No way to change access after creation** — `InlineDocEditor` has no access/visibility controls; only the creation dialog has `AccessPicker`
2. **Docs: Inline tag filter chips → dropdown** — Current tag filter uses inline chip buttons; user wants a dropdown select
3. **Docs: "Add tag" doesn't work** — The `+ tag` input has no visible focus state and likely gets missed; needs a proper tag add mechanism
4. **Docs: Callouts render as plain text** — Callouts insert raw `<div class="callout ...">` HTML but TipTap sanitizes custom divs, so they render as just "Info:" text with no styling
5. **Rich text editor: Glitchy text while typing** — The `useEffect` that calls `setContent` on every `content` prop change fights with the editor's internal state, causing cursor jumps and text glitches
6. **Activity sidebar bleeding off screen** — The sidebar's `w-[340px]` has no overflow constraints and the parent `flex` container doesn't properly bound it

---

## Fixes

### 1. Docs Access Picker (post-creation)
Add an inline `AccessPicker` to `InlineDocEditor` (below tags, collapsible) that calls `onUpdate` with visibility/sharedWith changes, persisting via the existing `handleInlineUpdate` which needs to forward `visibility` and `shared_with` to the DB update.

### 2. Tag Filter → Dropdown
Replace the inline chip tag filter in `DocsPage.tsx` sidebar with a multi-select `Popover` dropdown (button label "Filter by tag" + checkboxes for each tag + clear button).

### 3. Fix "Add Tag"
The tag input works via Enter key but the `onBlur` handler has a race condition. Fix: ensure `addTag` is called properly and add a small "+" button next to the input for discoverability.

### 4. Fix Callouts
Callouts use raw HTML `<div>` which TipTap strips. Fix: create a custom TipTap `Node` extension for callouts (node type `callout` with `data-type` attribute for info/warning/success/error). Update `SlashCommandMenu.tsx` to insert the callout node instead of raw HTML. The CSS already targets `.callout` classes — just needs the node to render the right classes.

### 5. Fix Glitchy Text (Content Sync)
The `useEffect` in `RichTextEditor.tsx` that re-sets content on every prop change causes cursor resets. Fix: remove the `useEffect` content sync (or gate it with a ref tracking whether the change was external vs internal). The editor's `onUpdate` already pushes changes outward — the parent should not push them back in.

### 6. Fix Sidebar Overflow
In `ActivitySidebar.tsx`: change the outer div from `w-[340px]` to `w-[340px] min-w-0` and ensure `overflow-hidden` on the flex parent. In `TaskDetailPage.tsx` and `ProjectDetailPage.tsx`: add `min-w-0` to the main workspace column so the flex layout doesn't overflow.

---

## Files

| Fix | File(s) |
|-----|---------|
| Docs access picker | Edit: `src/pages/DocsPage.tsx` (InlineDocEditor + handleInlineUpdate) |
| Tag filter dropdown | Edit: `src/pages/DocsPage.tsx` (sidebar section) |
| Fix add tag | Edit: `src/pages/DocsPage.tsx` (InlineDocEditor tag input) |
| Fix callouts | New: `src/extensions/CalloutNode.ts`, Edit: `src/components/SlashCommandMenu.tsx`, `src/components/RichTextEditor.tsx` |
| Fix glitchy text | Edit: `src/components/RichTextEditor.tsx` (remove/gate content useEffect) |
| Fix sidebar overflow | Edit: `src/components/ActivitySidebar.tsx`, `src/pages/TaskDetailPage.tsx`, `src/pages/ProjectDetailPage.tsx` |

