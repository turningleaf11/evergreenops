

# Global AI Companion — CEO/Admin Only

## Summary

Transform the current page-specific AI chat (Strategy Companion) into a **global floating companion** accessible from every page, restricted to admin users. Update the system prompt to be conversational and context-aware rather than rigidly structured. The companion becomes the CEO's primary input layer — a thinking partner that adapts its tone to the conversation.

## What changes

### 1. New global companion component
Create `src/components/GlobalCompanion.tsx` — a floating action button (bottom-right corner) that opens the AI chat sheet. Only renders when `isAdmin` is true (from AuthContext). Replaces the current `CeoAiChat` component with an upgraded version.

- Floating button: subtle branded circle with Bot icon, fixed position bottom-right
- Opens the same Sheet-based chat UI
- Persists conversation across page navigation (state lives in a context provider)
- Page-aware: detects current route and includes it in context sent to AI

### 2. Companion context provider
Create `src/contexts/CompanionContext.tsx` — holds chat messages, input state, and loading state so the conversation survives navigation between pages. Wraps inside the protected route area.

### 3. Updated edge function system prompt
Edit `supabase/functions/ceo-chat/index.ts`:
- Remove the rigid 5-part response format requirement
- New prompt: "You are a conversational strategy companion. Match the user's energy — if they're thinking out loud, think with them. If they ask a specific strategic question, give structured analysis. You have full context of the business."
- Add instruction: "When the user shares problems, frustrations, or ideas, help them organize their thinking. Suggest what might become a priority, a decision, a task, or a strategy item — but frame it as a suggestion, not a directive."
- Keep all the existing context injection (objective, priorities, tensions, pipeline, etc.)
- Add a `currentPage` field to context so AI knows where the user is

### 4. Render in Layout
Edit `src/components/Layout.tsx` — add `<GlobalCompanion />` inside the layout, gated behind `isAdmin` check.

### 5. Remove page-specific chat buttons
- Edit `src/pages/CeoDashboard.tsx` — remove the "Strategy Companion" button and `CeoAiChat` import. The global FAB replaces it.
- Keep `LeadershipAiChat` for now (different edge function, department-scoped, available to non-admins in future)

### 6. Markdown rendering
Install `react-markdown` and use it for assistant messages instead of the current regex-based `dangerouslySetInnerHTML` approach. Cleaner, safer, supports lists/code/headers properly.

## Files changed

| What | File |
|------|------|
| New companion context | `src/contexts/CompanionContext.tsx` |
| New global companion UI | `src/components/GlobalCompanion.tsx` |
| Add companion to layout | Edit: `src/components/Layout.tsx` |
| Update system prompt | Edit: `supabase/functions/ceo-chat/index.ts` |
| Remove page-specific chat | Edit: `src/pages/CeoDashboard.tsx` |
| Add react-markdown | `package.json` |

No database changes needed.

