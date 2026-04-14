

# Fix Icon Clash + De-form the UI

## 1. Differentiate header icons

Both `RemindersBell` and `NotificationBell` use the `Bell` icon from lucide-react. Change reminders to use `AlarmClock` (or `Clock`) so they're visually distinct at a glance.

## 2. Make create dialogs less "form-y"

The `GlobalCreateMenu` and `RemindersWidget` dialogs use stacked `<Label>` + `<Input>` patterns with explicit labels. Following the project's existing style direction (badge-style selectors, no focus rings, minimal chrome):

- **Remove explicit `<Label>` elements** — use placeholder text inside inputs instead
- **Priority/status**: Render as inline clickable badges (pill buttons) instead of `<Select>` dropdowns — e.g., three small pills for High / Medium / Low, highlighted state shows selection
- **Assignee/Department/Owner**: Use a compact popover trigger styled as a subtle text button ("+ Assign", "+ Department") instead of a full Select with label
- **Due date**: Use a calendar popover with quick-pick buttons (Today, Tomorrow, Next week) instead of `<Input type="datetime-local">`
- **Description**: Only show when user clicks "Add description" link — hidden by default to reduce visual weight
- **Layout**: Single-column flow with inline actions, no grid of labeled fields
- **Create button**: Slim, right-aligned or use Enter-to-submit instead of full-width button

## 3. Reminder widget create dialog — same treatment

Apply the same de-forming to the "New Reminder" dialog in `RemindersWidget.tsx`: placeholder-only title input, calendar popover for due date, optional delegate picker as a subtle "+ Assign" button.

## Files changed

| File | Change |
|------|--------|
| `src/components/RemindersWidget.tsx` | Change Bell → AlarmClock icon; restyle create dialog |
| `src/components/GlobalCreateMenu.tsx` | Restyle all create dialogs with inline badge pickers, no labels, collapsible description |

