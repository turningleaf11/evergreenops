

# Two Quick Fixes + People Page Discussion

## 1. Companion briefing on Strategy page (bug fix)

**Problem**: Line 58 in `CompanionContext.tsx` checks `location.pathname !== "/"` — so the proactive greeting only fires on the Home page, not `/ceo` (Strategy).

**Fix**: Change the condition to also include `/ceo`:
```
if (!open || (location.pathname !== "/" && location.pathname !== "/ceo") || messages.length > 0 || greetingSent.current || loading) return;
```

| File | Change |
|------|--------|
| `src/contexts/CompanionContext.tsx` | Update pathname check on line 58 to include `/ceo` |

## 2. Move Strategy page up in sidebar

**Problem**: In `AppSidebar.tsx`, the Strategy link (`/ceo`) is at the bottom of `mainNav`.

**Fix**: Reorder `mainNav` array to place Strategy between Home and Execution Hub:
```
{ title: "Home", url: "/", icon: Home },
{ title: "Strategy", url: "/ceo", icon: Compass },
{ title: "Execution Hub", url: "/execution", icon: Target },
...
```

| File | Change |
|------|--------|
| `src/components/AppSidebar.tsx` | Reorder `mainNav` array — move Strategy to position 2 |

## 3. People page admin management — awaiting discussion

No changes yet. Need your input on which management capabilities matter most:
- Assign/change departments
- Change user roles (admin/user)
- Remove team members
- Invite new members (UI for existing edge function)
- Edit profile details (name, title/position)
- See assigned tasks or activity

