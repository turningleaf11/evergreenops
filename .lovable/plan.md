

# Wiki Inline Creation, Larger Uploads, Giphy Search

## 1. Wiki: Inline Creation (No Popup)

Currently, clicking "New Page" opens a `DocEditor` dialog. Instead:

- Remove the `DocEditor` dialog import and usage from `DocsPage.tsx`
- When user clicks "+ New Page", instantly create a blank document in the database (title: "Untitled", empty content) and select it
- The existing `InlineDocEditor` component handles all editing inline — title, content, tags, visibility, parent page
- Add a parent-page selector as a small dropdown inside `InlineDocEditor` (currently missing — only set via the dialog)

**Files**: `src/pages/DocsPage.tsx` (remove dialog, add instant-create logic, add parent picker to InlineDocEditor)

## 2. Feed: Increase Image Upload Limit

Current hard limit is 5MB in `FeedComposer.tsx` line 53. The storage bucket itself has no such restriction.

- Raise the client-side limit from 5MB to 50MB in `FeedComposer.tsx`
- Update the toast message accordingly

**File**: `src/components/feed/FeedComposer.tsx`

## 3. Feed: Giphy Search (Replace Paste-URL)

Replace the current "paste GIF URL" input with a searchable Giphy picker. The Giphy API has a free tier that doesn't require an API key (using the public beta key `dc6zaTOxFJmzC` or we can use Tenor's free API). Approach:

- Add a `GiphyPicker` component: a popover with a search input that queries the Giphy API and displays a grid of results
- User clicks a GIF → sets `gifUrl` on the post
- Need a Giphy API key. Will use the Giphy public beta key for development, and add a secret for production use
- Replace the `LinkIcon + GIF` button with a proper GIF icon button that opens the picker popover

**Files**: New `src/components/feed/GiphyPicker.tsx`, edit `src/components/feed/FeedComposer.tsx`

## Technical Details

| Action | File |
|--------|------|
| Edit | `src/pages/DocsPage.tsx` — Remove DocEditor dialog, instant-create, add parent picker inline |
| Edit | `src/components/feed/FeedComposer.tsx` — 50MB limit, integrate GiphyPicker |
| New | `src/components/feed/GiphyPicker.tsx` — Searchable Giphy popover |

