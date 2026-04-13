

# Workspace Redesign: Task & Project Detail Pages

## Layout

```text
┌─────────────────────────────────────────────────────────────────┐
│ ← Back                                          Save as Template│
├───────────────────────────────────┬──────────────────────────────┤
│                                   │  Activity Sidebar (340px)    │
│  Title (borderless, large)        │  ┌────────────────────────┐  │
│                                   │  │ [All] [Comments] [Log] │  │
│  Status · Priority · Assignee ·   │  ├────────────────────────┤  │
│  Due · Project · Tags (compact)   │  │                        │  │
│                                   │  │  Merged timeline:      │  │
│  ─────────────────────────────    │  │  - comments (threaded) │  │
│                                   │  │  - status changes      │  │
│  Notes / Workspace                │  │  - assignments         │  │
│  (borderless TipTap editor,       │  │  - priority changes    │  │
│   full width, tall, document      │  │                        │  │
│   feel — THE primary area)        │  │                        │  │
│                                   │  ├────────────────────────┤  │
│  ─────────────────────────────    │  │ Comment input (sticky) │  │
│                                   │  └────────────────────────┘  │
│  Subtasks (compact checklist,     │                              │
│  collapsible, below notes)        │                              │
│                                   │                              │
└───────────────────────────────────┴──────────────────────────────┘
```

Mobile (< 768px): sidebar becomes a slide-out Sheet.

## Changes

### 1. Metadata — Compact Inline Row
Replace large Card/form grid with a single horizontal row of icon+value badges/dropdowns under the title. Tags as chips. No Card wrapper, no labels.

### 2. Notes / Workspace — Primary Focus (appears first)
- Remove Card/border wrapper around RichTextEditor
- Add `borderless` prop to `RichTextEditor.tsx` that strips border/rounded classes
- Increase `min-height` to `400px` in CSS for workspace mode
- Notes sit directly below metadata — the main content area

### 3. Subtasks — Below Notes
- Compact collapsible checklist section, rendered after the notes area
- No Card wrapper. Collapsed by default if empty.

### 4. Activity Sidebar (Right Panel)
- New `ActivitySidebar.tsx`: merges comments + entity_activity chronologically
- Filter tabs: All | Comments | Activity
- Sticky comment input at bottom
- Collapsible toggle; Sheet on mobile

### 5. Remove Tabs
Both pages lose the Subtasks/Notes/Comments tab system — everything visible at once in the new layout.

## Files

| What | File |
|------|------|
| Activity sidebar | New: `src/components/ActivitySidebar.tsx` |
| Borderless editor prop | Edit: `src/components/RichTextEditor.tsx` |
| Workspace mode styles | Edit: `src/components/RichTextEditor.css` |
| Task detail redesign | Edit: `src/pages/TaskDetailPage.tsx` |
| Project detail redesign | Edit: `src/pages/ProjectDetailPage.tsx` |

No database changes needed.

