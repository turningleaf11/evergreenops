

# Rich Text Editor for Docs & Database Pages

## Overview
Replace the plain textarea editors with a full rich text editing experience using **TipTap** (a headless, extensible rich text editor built on ProseMirror). Content will be stored as HTML strings, rendered inline on doc pages and in an expandable detail view for database rows.

## What Gets Built

### 1. TipTap Rich Text Editor Component (`src/components/RichTextEditor.tsx`)
A reusable editor with a floating/fixed toolbar supporting:
- **Headings** (H1, H2, H3)
- **Text formatting** — bold, italic, underline, strikethrough, code
- **Lists** — bullet, numbered, task/checklist
- **Callout blocks** — info, warning, success, error (custom extension or blockquote with styling)
- **Color picker** — text color and highlight/background color
- **Links** and **embeds** (iframe for YouTube/URLs)
- **Code blocks** with syntax style
- **Dividers** (horizontal rule)
- **Block quotes**

Toolbar styled to match the Notion-minimal aesthetic — small icon buttons in a sticky bar above the editor.

### 2. Update DocEditor Dialog
- Replace the `<Textarea>` with the new `RichTextEditor` component
- Content stored/saved as HTML string
- Expand dialog to `max-w-3xl` for comfortable editing

### 3. Update DocsPage Content Rendering
- Replace `<p>{selected.content}</p>` with `dangerouslySetInnerHTML` rendering the HTML content
- Apply Tailwind `prose` classes for clean typography

### 4. Add Notes/Description Field to Database Rows
- Add a "notes" or "description" rich text field to the `DatabaseItemEditor` dialog
- Store as an extra `_notes` key in the row values
- Show expandable content when clicking a row in table/list view

### 5. Content Data Migration
- Update mock data `content` fields from plain text to HTML strings so existing docs render correctly

## Dependencies to Install
- `@tiptap/react` — React bindings
- `@tiptap/starter-kit` — core extensions (bold, italic, headings, lists, code, blockquote, hr)
- `@tiptap/extension-color` — text color
- `@tiptap/extension-text-style` — text style base
- `@tiptap/extension-highlight` — background highlight
- `@tiptap/extension-underline` — underline
- `@tiptap/extension-link` — clickable links
- `@tiptap/extension-task-list` + `@tiptap/extension-task-item` — checkable task lists
- `@tiptap/extension-placeholder` — placeholder text

## New Files
- `src/components/RichTextEditor.tsx` — the editor + toolbar component
- `src/components/RichTextEditor.css` — custom styles for callouts, editor chrome

## Modified Files
- `package.json` — add TipTap dependencies
- `src/components/DocEditor.tsx` — swap Textarea for RichTextEditor, widen dialog
- `src/pages/DocsPage.tsx` — render HTML content with prose styling
- `src/components/DatabaseItemEditor.tsx` — add rich text notes field
- `src/lib/mock-data.ts` — convert plain text content to HTML

## Build Order
1. Install TipTap packages
2. Build `RichTextEditor` component with toolbar and all extensions
3. Integrate into `DocEditor` dialog
4. Update `DocsPage` to render HTML content
5. Add notes field to `DatabaseItemEditor`
6. Update mock data content to HTML

