# OpsHQ — Design & Code Conventions

This file is read by Claude at the start of every session. Follow these rules exactly.
Do not invent new patterns when existing ones cover the case.

---

## Stack

- React + TypeScript + Vite
- Tailwind CSS with shadcn/ui components
- Supabase (auth + DB). Multi-tenant via `workspace_id`.
- TipTap rich text editor (`RichTextEditor` component)
- ReactFlow (`@xyflow/react`) for process map canvases
- `sonner` for toasts (import from `"sonner"`, not `"@/hooks/use-toast"`)

---

## Design System

### Token usage — ALWAYS use CSS variables, NEVER hardcode colors

```tsx
// ❌ WRONG — breaks in dark mode
className="bg-red-100 text-red-800"
className="bg-yellow-100 text-yellow-800"
className="bg-green-100 text-green-800"
className="bg-blue-100 text-blue-800"

// ✅ CORRECT — use semantic tokens
className="bg-destructive/10 text-destructive"
className="bg-amber-500/10 text-amber-700 dark:text-amber-400"
className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
className="bg-blue-500/10 text-blue-700 dark:text-blue-400"
```

### StatusBadge — the ONLY way to render status/priority/type chips

```tsx
import { StatusBadge, TASK_STATUS_VARIANT, PRIORITY_VARIANT } from "@/components/shared/StatusBadge";

// Status chip
<StatusBadge label="In Progress" variant={TASK_STATUS_VARIANT[status]} />

// Priority chip
<StatusBadge label={PRIORITY_LABEL[priority]} variant={PRIORITY_VARIANT[priority]} dot />

// Process node type
<StatusBadge label="Source" variant={PROCESS_NODE_VARIANT["source"]} size="xs" />
```

Never define local `statusConfig`, `priorityLabels`, or badge color maps in page components.
Always add new variants/maps to `StatusBadge.tsx` instead.

### CSS utility classes (use these, don't reinvent them)

| Class | Use |
|---|---|
| `.crm-card` | Standard card surface (`rounded-xl bg-card p-6 border shadow-sm`) |
| `.crm-card-muted` | Muted/secondary card |
| `.crm-eyebrow` | Section label above a group (`11px bold uppercase tracking-wide muted`) |
| `.crm-field-label` | Field label above an input |
| `.crm-section-stack` | Vertical spacing between card sections (32px) |
| `.crm-field-stack` | Vertical spacing between fields (16px) |
| `.elevation-1/2/3` | Programmatic box-shadow (prefer CSS var-based, not raw `shadow-*`) |
| `.page-title` | Top-level page heading (`text-3xl font-bold tracking-tight`) |
| `.section-title` | Section heading within a page |

### Card patterns

Cards are **click targets** — the whole card opens a detail view. Never put expanding panels inside cards.

```tsx
// Standard interactive card
<div
  onClick={onOpen}
  className="rounded-xl border bg-card hover:shadow-lg hover:-translate-y-px transition-all cursor-pointer"
  style={{ borderLeft: `3px solid ${typeColor}` }}
>
```

Action menus go in a `...` (MoreHorizontal) button. No inline action buttons on cards.

### Typography scale

- Page title: `text-3xl font-bold tracking-tight` (use `.page-title`)
- Section heading: `text-lg font-bold tracking-tight` (use `.section-title`)
- Card name / primary content: `text-[15px] font-semibold tracking-tight`
- Secondary text / metadata: `text-xs text-muted-foreground`
- Eyebrow label: `.crm-eyebrow` (never use a raw `text-xs uppercase`)

### Spacing

- Page content padding: `px-6 py-6` or `p-6`
- Card internal padding: `p-4` (compact) or `p-6` (standard)
- Between sections on a page: use `.crm-section-stack` or `space-y-8`
- Between fields in a form: use `.crm-field-stack` or `space-y-4`

---

## Component conventions

### RichTextEditor

```tsx
// Full-page notes editor
<RichTextEditor content={html} onChange={fn} borderless />

// Inside a sheet/panel (NOT compact — use minHeight instead)
<RichTextEditor content={html} onChange={fn} borderless minHeight="240px" />

// Tiny inline composer
<RichTextEditor content={html} onChange={fn} compact />
```

Never use `compact` inside a sheet or detail panel — it's too small and feels cheap.

### Empty states

Use `<EmptyState />` from `@/components/shared/EmptyState`. Don't write bare italic text.

### Toasts

```tsx
import { toast } from "sonner";
toast.success("Saved"); toast.error(error.message);
```

---

## Database conventions

- Every table has `workspace_id` — always filter by it.
- Auth user key in `profiles` table is `user_id` (NOT `id`). Always `select("user_id, full_name, avatar_url")`.
- `process_buckets` is self-referential — `parent_id` = sub-process parent.

---

## UX/Premium quality bar

This app targets Fortune-500-quality SaaS polish. Before shipping any UI:

1. **Dark mode**: every color must work in dark mode (use CSS vars, not hardcoded hex/rgb)
2. **Empty states**: every list/table has a meaningful empty state
3. **Loading states**: use `Loader2 animate-spin` while data loads, never blank
4. **No inline text actions**: actions live in `...` menus or hover-reveal buttons
5. **Consistent card structure**: name/title is the hero, metadata is secondary, owner/date is footer
6. **No pill labels for state changes**: use visual treatment (opacity, border color, icon swap) not badge stacking

---

## Files to know

| Path | Purpose |
|---|---|
| `src/index.css` | All CSS variables (light + dark), utility classes |
| `tailwind.config.ts` | Token → Tailwind class mappings |
| `src/components/shared/StatusBadge.tsx` | Shared badge component — all status/priority chips |
| `src/components/shared/EmptyState.tsx` | Shared empty state |
| `src/components/RichTextEditor.tsx` | TipTap rich text with slash commands |
| `src/components/SlashCommandMenu.tsx` | Slash command menu for RichTextEditor |
| `src/lib/processMap.ts` | ProcessBucket CRUD + canvas helpers |
