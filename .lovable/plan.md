

# Image Upload, File Attachments & Department Pinboard

## Part 1: Storage Bucket Setup

Create a `files` storage bucket for all uploaded images and file attachments. Public bucket so URLs can be used directly in editor content and department pinboards.

**Migration SQL**:
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('files', 'files', true);
-- RLS: authenticated users can upload, anyone can read
CREATE POLICY "Authenticated users can upload files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'files');
CREATE POLICY "Anyone can view files" ON storage.objects FOR SELECT USING (bucket_id = 'files');
CREATE POLICY "Uploaders can delete their files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'files' AND (auth.uid())::text = (storage.foldername(name))[1]);
```

## Part 2: Editor — Image Upload & Paste

**File**: `src/components/RichTextEditor.tsx`

- Add a helper function `uploadFile(file: File)` that uploads to the `files` bucket via Supabase storage SDK, returns the public URL
- Add `handlePaste` and `handleDrop` to `editorProps` — detect image files, upload them, insert `setImage({ src: publicUrl })`
- This makes copy/paste of images work automatically

**File**: `src/components/SlashCommandMenu.tsx`

- Change the "Image" slash command from `window.prompt` to triggering a hidden `<input type="file" accept="image/*">` — user picks a file, it uploads, then inserts the image
- Add a new "File Attachment" slash command that accepts any file type, uploads it, and inserts a styled link block (filename + download icon)

## Part 3: File Attachment Node (optional custom TipTap node vs simple link)

For non-image files, insert them as styled anchor tags with a download icon and filename — no custom TipTap node needed. The slash command will insert HTML like:
```html
<a href="url" class="file-attachment">📎 filename.pdf</a>
```
This keeps it simple and renders in any context where the HTML is displayed.

## Part 4: Department Pinboard

**New table**: `department_pinboard`

```sql
CREATE TABLE public.department_pinboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'link',  -- 'link', 'file', 'note', 'image'
  title text NOT NULL,
  url text,          -- for links and files
  description text DEFAULT '',
  icon text DEFAULT 'Link',
  sort_order integer DEFAULT 0,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE department_pinboard ENABLE ROW LEVEL SECURITY;
-- RLS policies
```

**File**: `src/pages/DepartmentPage.tsx`

Add a "Pinboard" section between Resources & Playbooks and Team. Features:
- Grid of pinned items: links (with custom icon/emoji), uploaded files, notes, images
- "Add" button opens a small dialog to create a link/button or upload a file
- Each item renders as a compact card with icon, title, and optional description
- Links open in new tab, files download, notes display inline
- Items are sortable (drag or sort_order)
- Admins can delete/edit items

## Files Changed

| What | File |
|------|------|
| Storage bucket + pinboard table | New migration |
| Image upload, paste, drop support | Edit: `src/components/RichTextEditor.tsx` |
| File upload slash command, image upload slash command | Edit: `src/components/SlashCommandMenu.tsx` |
| Pinboard section | Edit: `src/pages/DepartmentPage.tsx` |

