

# Plan: Notes Sharing, Universal @mentions, App Density, AI Email, and Polish

Seven distinct improvements. Phasing in two waves so we ship value fast.

## 1. Notes — Public URL + Team Sharing

Add sharing to the existing Notes page.

**Schema:**
- Add columns to `notes`: `share_token text unique`, `is_public boolean default false`, `shared_with jsonb default '{"memberIds":[]}'`
- New public route `/n/:token` rendering note read-only (no auth required, RLS policy permits select where `is_public = true`)

**UI:**
- "Share" button in note editor header → popover with:
  - Toggle: "Anyone with the link can view" → generates/reveals `https://app/n/{token}`, copy button
  - Member multi-select (reuses existing AccessPicker pattern) → grants read access to specific teammates
- Shared notes appear in recipient's sidebar under a new "Shared with me" section

## 2. Universal @mention System

A reusable mention popover triggered by `@` in any rich text / textarea surface (chats, comments, notes, discussions).

**Component:** `src/components/shared/MentionPicker.tsx`
- On `@` keystroke, open positioned popover
- Searches across: docs (wikis), notes, database records, tasks, projects, goals, people
- Single unified search edge function `universal-search` returning `{ id, type, title, url, icon }`
- Insert renders as a styled chip with link to the entity (opens in appropriate peek)

**Surfaces wired:**
- TipTap RichTextEditor (TipTap Mention extension)
- CommentsSection / RichCommentInput
- ProjectChatRail
- AI chat inputs (HomeAiChat, GlobalCompanion) — uses mentions as context for the AI

## 3. App Density — Fix "Too Small" on Desktop

Root cause: pages cap at `max-w-7xl` (1280px) with default 14px font on screens up to 1920px+. On a 1423px viewport (current), 80%+ of pixels are empty.

**Fixes:**
- Bump base font: `html { font-size: 15px }` (Tailwind scales accordingly)
- Widen page containers: `max-w-7xl → max-w-[1600px]`, `max-w-6xl → max-w-[1400px]` across `Index.tsx`, `DocsPage`, `DatabasesPage`, `DepartmentPage`, `ExecutionPage`, `PeoplePage`, etc.
- Slightly larger header (`h-[60px] → h-[64px]`) and sidebar text
- Mobile untouched (responsive `sm:` breakpoints preserved)

## 4. Wikis & Notes — More Side Cushion (2.5×)

Currently editor area uses ~`px-6`. Bump editor inner padding to `px-16` on `lg:` screens (≈ 2.5× current) for both `DocsPage` and `NotesPage` editor surfaces. Doesn't apply to sidebar lists.

## 5. Onboarding Banner — Auto-Hide on Completion

Currently the banner only hides if explicitly dismissed. Fix:
- In `OnboardingBanner.tsx`, when `allDone` is true AND `completedOnboardingSteps.length === onboardingSteps.length`, auto-call `dismissOnboarding()` once (or just `return null` when complete after a 3-second celebration)
- Add the auto-dismiss inside a `useEffect` so it persists across reloads

## 6. AI-Managed Email + Better Composer + Labels

**AI Triage (new edge function `email-ai-triage`):**
- "Summarize inbox" button → AI groups threads into: Action needed, FYI, Newsletter, Awaiting reply
- Per-thread "AI suggest reply" → drafts a response in the composer
- "Smart labels" — AI auto-tags incoming threads (Customer, Internal, Vendor, etc.) using Gemini 2.5 Flash

**Labels UI:**
- New left sidebar section under folders: "Labels" with color dots
- Click label → filters inbox by `labelIds` containing that label
- Manage labels modal (create/rename/delete/color)
- Wire to existing Gmail `labelIds` field + a local `email_labels` table for color/display

**Composer enhancement (replaces ComposeModal):**
- Convert from form-style modal to **slide-up email draft panel** (Gmail-like bottom-right floater)
- `RichTextEditor` for body (formatting, lists, links, images)
- Recipient chips with autocomplete (people directory + recent senders)
- Attachments via existing `uploadFile`
- "AI write" / "AI improve tone" buttons
- Drafts auto-save

## 7. Phasing

- **Phase 1 (this run):** #3 density, #4 cushion, #5 onboarding fix, #1 Notes sharing, #6a composer rewrite + labels UI
- **Phase 2 (follow-up):** #2 universal @mentions (touches many files), #6b AI email triage

Approve and I'll execute Phase 1.

