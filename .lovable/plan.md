
The user wants the CEO Scratch Pad to accept images (upload + paste) and have the AI read them (OCR/vision) when processing.

Looking at the existing code:
- `ScratchPad.tsx` uses `RichTextEditor` (TipTap) and already extracts images from HTML via `extractTextAndImages` — so images embedded in the editor are already passed up as data URLs / URLs.
- `ceo-triage` edge function **already supports multimodal input** — it accepts `images` array and forwards them to Gemini as `image_url` parts. ✅
- So the backend is ready. What's missing is making it easy to **get images into the scratch pad**.

Need to verify: does `RichTextEditor` support image paste/upload? Let me note what to check during implementation: TipTap Image extension + paste handler + upload to `files` bucket (so the URL is accessible to the AI, not a giant base64 in the DB).

## Plan

**1. Add image support to the Scratch Pad**
- Add a small image button (paperclip/image icon) next to the Sparkles button in the Scratch Pad header — opens file picker, uploads via existing `uploadFile` helper to the `files` storage bucket, inserts `<img src="...">` into the editor.
- Add **paste handler** on the editor wrapper: when user pastes an image (clipboard `image/*`), upload it and insert at cursor.
- Add **drag-and-drop** on the editor wrapper for images.
- Show a tiny "Uploading…" indicator while the upload is in flight.

**2. Ensure RichTextEditor renders images**
- Verify TipTap `Image` extension is enabled in `RichTextEditor.tsx`. If not, add it so pasted/inserted `<img>` tags render.

**3. AI processing already works**
- `extractTextAndImages` already pulls all `<img src>` from the editor HTML.
- `ceo-triage` already sends them as `image_url` parts to Gemini 2.5 Flash (multimodal).
- No backend changes needed.

**4. Light UX polish**
- Update placeholder text to mention "paste a photo of handwritten notes too."
- Toast on upload failure.

## Files to change
- `src/components/ScratchPad.tsx` — add image upload button, paste handler, drag-drop, uploading state.
- `src/components/RichTextEditor.tsx` — confirm/add TipTap Image extension (only if missing).

No DB changes. No new edge functions. No new secrets.
