---
name: Multi-User Reminder Delegation
description: Reminders support delegation to multiple users via reminder_assignees junction table with people picker UI.
type: feature
---
Reminders can be delegated to multiple team members:

- **reminder_assignees** junction table: reminder_id, user_id, completed
- RLS: assignees can view/update their own; creators can manage all assignees on their reminders
- Reminders SELECT policy includes OR EXISTS check on reminder_assignees
- Create dialog includes PeoplePicker multi-select component
- Assignees shown as removable badges below the picker
- Bell still shows reminders where user is creator, assigned_to, or in junction table
