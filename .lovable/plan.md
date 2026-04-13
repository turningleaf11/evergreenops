

# Fix: Department Docs Not Showing

## Root Cause

The `isSharedWithDept` function in `DepartmentPage.tsx` checks for `visibility === "department"` (singular), but the `AccessPicker` saves the value as `"departments"` (plural). Additionally, some docs have `visibility: "team"` (a legacy value) which should also be treated as workspace-visible.

## Fix

**File**: `src/pages/DepartmentPage.tsx`

Update the `isSharedWithDept` function (line 33-40) to handle both plural and singular forms, plus the `"team"` legacy value:

```typescript
function isSharedWithDept(item: { visibility: string; shared_with: any }, deptId: string): boolean {
  if (item.visibility === "workspace" || item.visibility === "team") return true;
  if ((item.visibility === "departments" || item.visibility === "department") && item.shared_with) {
    const sw = typeof item.shared_with === "string" ? JSON.parse(item.shared_with) : item.shared_with;
    return (sw.departmentIds || []).includes(deptId);
  }
  return false;
}
```

One-line fix — no database changes needed.

