## Plan

1. Fix the list record slideout so it stays open during normal interaction.
   - Update the list record detail sheet so opening the record does not immediately focus a title input that auto-saves on blur.
   - Separate “editing the title” from “saving and closing the record” so a click inside the sheet no longer triggers an unintended close.
   - Keep outside-click protection for popovers/menus, but preserve normal sheet behavior when the user intentionally closes it.

2. Add a clear, minimal “open record” affordance anywhere a table row can also be edited inline.
   - Add a subtle icon-only open control for list table rows, list card/list rows, execution task tables, and execution project tables.
   - Make that control explicitly open the full record while title cells continue to behave as inline-edit fields.
   - Stop event propagation on the new control so it never conflicts with inline inputs, selects, assignee pickers, or row-level actions.

3. Keep the interaction model consistent with existing peek rules.
   - List/database rows continue to open in the side sheet.
   - Tasks continue to open in the task side sheet.
   - Projects continue to open their full page.
   - Use the same minimal visual language across these surfaces so users can quickly recognize the “open” action.

## Files to update
- `src/components/DatabaseRecordDetail.tsx`
- `src/pages/DatabasesPage.tsx`
- `src/components/DatabaseView.tsx`
- `src/components/execution/DataTableView.tsx`
- `src/components/execution/TableView.tsx`

## Technical details
- Root cause of the disappearing list sheet: the record title is currently rendered as a live input in the sheet header, and its `onBlur` calls the page save handler, which then closes the sheet. The first click elsewhere inside the sheet causes that blur, so the sheet appears to dismiss itself.
- The fix will make title editing intentional instead of auto-closing on blur, and only close on explicit close actions or after actions that should actually dismiss the sheet.
- No backend or database changes are needed.
- UI treatment will stay minimal: an icon-only open control with low visual weight, placed where it is discoverable but does not compete with inline editing.