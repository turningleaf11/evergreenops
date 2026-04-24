## Plan

Restore file behavior so clicking a PDF opens the in-app viewer again, with Download and Open in new tab as secondary actions instead of redirecting away.

### What I’ll change

1. Update the file viewer logic to stop forcing PDFs to open natively on click.
   - Keep the modal viewer as the default for PDFs.
   - Preserve the existing Download and Open in new tab buttons inside the viewer.

2. Narrow the “open natively” fallback to only the file types that truly need it.
   - Keep Office documents (`.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`) opening outside the app if needed.
   - Remove PDFs from that native-open rule so they stay in-app.

3. Keep link interception working across list/database contexts.
   - Ensure `.file-attachment` links and storage-hosted file URLs still get intercepted by `FileViewerProvider`.
   - Preserve row click behavior so file-link clicks do not accidentally trigger row navigation.

4. Improve the PDF preview fallback inside the modal.
   - Show the embedded preview when the browser allows it.
   - If a specific browser blocks embedded viewing, keep a graceful fallback message and actions inside the modal instead of auto-redirecting the user away.

5. Verify affected entry points.
   - Database table file cells
   - Record detail file links
   - Any rich-text file attachment links that rely on the global file-viewer event/interceptor

### Files involved

- `src/components/file-viewer/FileViewerProvider.tsx`
- Possibly small follow-up adjustments in:
  - `src/lib/file-upload.ts`
  - `src/components/DatabaseView.tsx`
  - `src/components/DatabaseRecordDetail.tsx`

### Technical details

Current behavior is caused by `shouldOpenNatively()` in `FileViewerProvider.tsx`, which explicitly treats PDFs as native-only:

```ts
if (m === "application/pdf" || n.endsWith(".pdf")) return true;
```

That causes both direct `open()` calls and intercepted anchor clicks to run `window.open(...)` immediately. I’ll change that rule so PDFs are handled by the modal viewer again, while still allowing Office formats to bypass the viewer if needed.

Inside the modal, the existing blob-based loading flow already supports:
- authenticated/storage-backed file download
- PDF kind detection
- Download/Open in new tab controls

So the main fix is to restore PDFs to the viewer path and keep browser-specific fallback behavior inside the modal rather than as the default click behavior.