

# Revert accordion field rows → use inline dropdowns

User wants: clicking a field shows a **small dropdown/popover** with options, NOT an inline expanding accordion that pushes content. The current `AccordionField` pattern needs to be replaced.

## Approach

Replace `AccordionField` rows in the drawer with **field rows that open a Popover on click**. Same clean "label-first" look (label + current value as badge/text), but clicking the value opens a compact floating dropdown anchored to the row — nothing pushes, nothing expands inline.

Visual stays the same at rest:
```
Status        In Progress  ▾
Priority      High         ▾
Assignee      Sarah Chen   ▾
```

Click "Status" → small popover floats next to it with the option list. Pick one → popover closes, value updates. Click outside → closes.

## Files to change

### 1. `src/components/shared/AccordionField.tsx` → repurpose as `FieldRow`
- Remove the expand/collapse logic and inline child rendering
- Keep the label + display value layout
- Wrap the row in a `Popover`. The row itself is the `PopoverTrigger`. Children render inside `PopoverContent` (compact, `w-56`, `p-1`, anchored start).
- Drop the `isOpen` / `onToggle` props — Popover handles its own open state
- Keep optional `icon` prop

New signature:
```tsx
<FieldRow label="Status" icon={AlertCircle} displayValue={<Badge>In Progress</Badge>}>
  <OptionRow ...>Not Started</OptionRow>
  <OptionRow ...>In Progress</OptionRow>
  ...
</FieldRow>
```

For read-only fields (no children needed), render without Popover wrapper.

### 2. `src/components/DetailDrawer.tsx`
- Remove `openField` state and `toggle` handler
- Replace each `AccordionField` with `FieldRow` (no `isOpen`/`onToggle` props)
- Each option's `onClick` no longer needs to call `setOpenField(null)` — Popover closes via its own `onOpenChange`. Use a small wrapper that closes the popover on select.

### 3. `src/components/DatabaseRecordDetail.tsx`
- Same swap: `AccordionField` → `FieldRow`
- Remove `openField` state
- For text/textarea/number/date custom field types, use a small inline editor inside the popover (Input/Textarea + autosave on blur)

### 4. Keep
- Same chevron icon (rotates when popover open via Popover's data attr, optional)
- Same row hover, same label width, same badge styling
- Title remains as the drawer header

## Files Summary

| Action | File |
|--------|------|
| Edit | `src/components/shared/AccordionField.tsx` — convert to `FieldRow` with Popover |
| Edit | `src/components/DetailDrawer.tsx` — remove openField state, swap to FieldRow |
| Edit | `src/components/DatabaseRecordDetail.tsx` — same swap |

No DB changes. Pure UI revision.

