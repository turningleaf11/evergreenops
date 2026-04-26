# Unified "Activity" Panel + Rich Composer Everywhere

Replace every "Comments" / "Notes" / "Activity" surface with a single ClickUp-style **Activity** panel: a chronological feed that interleaves system events with user comments, anchored by a feature-rich composer at the bottom.

## What you'll see

```text
┌─────────────────────────────────────────┐
│ Activity                  🔍 🔔 ▼ filter│   header (title + filter chip)
├─────────────────────────────────────────┤
│ • You created this lead    Jan 4, 3:05p │
│ › Show more                             │
│ • You changed status → Hot   Jan 5      │
│                                         │
│ [Avatar] Sam · 2h ago                   │
│   Got the OM, looks promising. @Mia     │   threaded comment
│   📎 OM_2025.pdf                        │
│   ❤️ 2   💬 Reply                       │
│                                         │
│ • Mia uploaded T12.xlsx     1h ago      │
├─────────────────────────────────────────┤
│ Write a comment…                        │   rich composer
│ + 📎 @ GIF 😊 🎥 🎤 ☑ 📄 🖼      ➤ ▾   │
└─────────────────────────────────────────┘
```

- **One stream**: comments + system events sorted by time. Filter chip toggles **All / Comments / Activity**.
- **Composer (single component, used everywhere)**:
  - TipTap-powered rich text (bold, italic, lists, links)
  - `@` mentions — people (clickable, opens person peek)
  - `/` slash menu — same one used in Docs (text/heading/checklist/quote/code/divider/image/file/AI actions)
  - Attach file, image, GIF (existing GiphyPicker), emoji picker
  - Voice note recording (reuse the MediaRecorder logic from `ReplyThread`)
  - Submit on ⌘/Ctrl+Enter; Shift+Enter for newline
- **Replies**: threaded under each comment, reactions on every comment (existing `CommentReactions`).

## Where it goes (all entity detail surfaces)

The unified `<ActivityPanel entityType=… entityId=… />` replaces:

| Surface | File | Current |
|---|---|---|
| Project chat rail | `ProjectChatRail.tsx` | `CommentsSection` |
| Task peek | `TaskPeek.tsx` | `CommentsSection` |
| Goal peek | `GoalPeek.tsx` | `CommentsSection` + `EntityActivity` |
| Issues page detail | `IssuesPage.tsx` | `CommentsSection` |
| Department page detail | `DepartmentPage.tsx` | `CommentsSection` |
| Generic detail drawer | `DetailDrawer.tsx` | `CommentsSection` |
| Database record detail | `DatabaseRecordDetail.tsx` | `CommentsSection` |
| CRM Lead peek | `LeadPeekSheet.tsx` | (mixed today) |
| CRM Deal peek | `DealPeekSheet.tsx` | `CrmActivityTimeline` + Broker Comms tab |
| CRM Contact peek | `ContactPeekSheet.tsx` | timeline |
| CRM Transaction detail | `TransactionDetailSheet.tsx` | timeline |

CRM "Activity" tabs collapse into the single Activity panel. **Broker Comms tab is removed** (per your call) — broker feedback becomes regular Activity comments.

Personal Notes (Scratchpad) stays as a standalone doc editor — it isn't an entity activity stream — but its editor already has `/` and `@`, so no change needed there.

## Technical plan

### 1. New component: `src/components/activity/ActivityPanel.tsx`
Props: `entityType`, `entityId`, `hideHeader?`, `defaultFilter?`.
- Fetches `comments` + `entity_activity` for the entity, merges & sorts by timestamp.
- Renders system events as compact one-liners (icon + actor + verb + time) using the existing `describeAction` mapping (extended with CRM verbs like `stage_changed`, `buy_box_set`, `lead_converted`).
- Renders comments as full cards with avatar, attachments, reactions, replies.
- Filter chip in header: All / Comments / Activity.
- Realtime subscribe to both tables so the feed updates live.
- Composer pinned at bottom (matches the screenshot layout you sent).

### 2. New composer: `src/components/activity/ActivityComposer.tsx`
A TipTap-based input replacing `RichCommentInput`. Extensions:
- `StarterKit`, `Link`, `Image`
- `MentionExtension` (existing) for `@` people
- `SlashCommands` (existing — same one Docs uses) for `/`
- New small toolbar row below the editor with: attach file, image, GIF (opens existing `GiphyPicker`), emoji (use `emoji-picker-react` or a small native picker), voice (port `MediaRecorder` logic out of `ReplyThread`), send button.
- Saves to `comments` table with `content` (HTML), `attachments`, `mentions`, plus two new columns: `gif_url`, `audio_url` (mirrors `post_replies`).

### 3. Schema migration
Add to `comments` table:
- `gif_url text`
- `audio_url text`
- `content_html text` (keep existing `content` for plaintext fallback / search)

Backfill is unnecessary — old comments keep working.

### 4. Activity event coverage
Make sure every important state change writes to `entity_activity` so the unified stream is complete. Audit and add where missing:
- CRM lead: `created`, `status_changed`, `buy_box_set`, `converted_to_deal`, `file_uploaded`
- CRM deal: `created`, `stage_changed`, `under_contract`, `file_uploaded`
- CRM transaction: `created`, `checklist_item_completed`, `closed`
- Tasks/Projects/Goals/Issues: ensure `status_changed`, `assigned`, `priority_changed`, `file_uploaded` all log

### 5. Migrate call sites
Swap every `<CommentsSection .../>` and standalone `<EntityActivity .../>` for `<ActivityPanel entityType=… entityId=… hideHeader />`. Rename the section header label to **"Activity"** in every parent (rail, peek, drawer, tab).

For CRM peeks: remove the separate "Activity" tab and either (a) keep a slim Activity tab that renders `ActivityPanel`, or (b) make Activity the default tab. **Recommendation: dedicated Activity tab**, since CRM peeks already use tabs.

For Deal peek: delete the Broker Comms tab and `DealBrokerCommsTab.tsx`. Leave the `broker_feedback` table intact (no destructive migration) but stop reading/writing to it from the UI.

### 6. Files removed/deprecated
- `src/components/CommentsSection.tsx` → replaced by `ActivityPanel`
- `src/components/EntityActivity.tsx` → folded into `ActivityPanel`
- `src/components/shared/RichCommentInput.tsx` → replaced by `ActivityComposer`
- `src/components/crm/DealBrokerCommsTab.tsx` → removed

### 7. Polish
- Header matches your screenshot: **"Activity"** title, search/bell/filter icons on the right.
- Composer chrome matches: rounded card, icon row across the bottom, send button on the right with a small dropdown caret for "Send & resolve" / "Send" (future-proof, hidden for v1).
- Consistent across all surfaces (rail, peek, drawer, tab) — single component, no per-surface variants.

## Out of scope for this pass
- Email-style "Send" variations beyond plain comment
- Notifications routing for new activity types (already handled by existing notification system where wired)
- Migrating existing `broker_feedback` rows into `comments` (table preserved as-is)
