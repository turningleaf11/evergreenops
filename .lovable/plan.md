

# Editor Experience Upgrade — Slash Commands, Bubble Menu, Block UX

## Overview
Upgrade the existing TipTap-based RichTextEditor to support slash command menu, inline floating toolbar on text selection, and Notion-inspired block interaction UX. The editor already uses TipTap with StarterKit, so we leverage TipTap's built-in `BubbleMenu` and `FloatingMenu` extensions plus a custom slash command suggestion plugin.

## What Changes

### 1. Install new TipTap extensions
- `@tiptap/extension-image` — image block support
- `@tiptap/suggestion` — powers the slash command menu

`BubbleMenu` and `FloatingMenu` are already included in `@tiptap/react`.

### 2. Slash Command Menu (`src/components/SlashCommandMenu.tsx`)
- Custom TipTap extension using `@tiptap/suggestion` that triggers on `/`
- Renders a floating dropdown positioned near the cursor
- Menu items: Text, Heading 1/2/3, Bullet List, Numbered List, Checklist, Callout (info/warning/success/error), Divider, Code Block, Blockquote, Image
- Supports keyboard navigation (arrow keys + Enter) and search filtering as user types after `/`
- Clean, minimal dropdown with icons and labels
- Dismisses on Escape or clicking outside

### 3. Inline Highlight Toolbar (BubbleMenu)
- Use TipTap's built-in `BubbleMenu` component — appears on text selection
- Actions: Bold, Italic, Underline, Strikethrough, Code, Link, Text Color
- Minimal floating bar with small icon buttons
- Disappears when selection is cleared

### 4. Block Interaction UX
- Use TipTap's `FloatingMenu` — shows a `+` button on empty lines/paragraphs
- Clicking `+` triggers the slash command menu at that position
- Clean hover states, no heavy borders

### 5. Remove Static Toolbar
- Remove the existing fixed toolbar bar at the top of the editor
- All formatting is now accessed via BubbleMenu (on selection) or slash commands (on `/`)
- Results in a cleaner, more spacious Notion-like editing experience

### 6. Update CSS (`src/components/RichTextEditor.css`)
- Add styles for slash command dropdown (floating, shadowed, rounded)
- Add styles for bubble menu (compact, dark background)
- Add image block styles
- Increase editor padding and spacing for Notion-like feel
- Subtle focus/hover states

## Files

| File | Change |
|------|--------|
| `src/components/SlashCommandMenu.tsx` | **New** — Slash command extension + dropdown UI |
| `src/components/RichTextEditor.tsx` | Replace static toolbar with BubbleMenu + FloatingMenu, add slash command extension, add Image extension |
| `src/components/RichTextEditor.css` | Updated styles for bubble menu, slash menu, block spacing, image blocks |

## Technical Notes
- The editor remains a single TipTap instance outputting HTML (no structural change to data model — TipTap internally manages blocks as nodes)
- The slash command uses `@tiptap/suggestion` which handles positioning, keyboard nav, and filtering
- BubbleMenu is a first-class TipTap React component — no custom positioning needed
- Image extension uses `@tiptap/extension-image` with URL input (no upload in this phase)
- All existing content formats (callouts, task lists, etc.) continue to work

## Build Order
1. Install `@tiptap/extension-image` and `@tiptap/suggestion`
2. Create `SlashCommandMenu.tsx` with suggestion plugin + dropdown UI
3. Rewrite `RichTextEditor.tsx` — remove static toolbar, add BubbleMenu + FloatingMenu + slash commands
4. Update CSS for new UI elements

