## Plan

1. Replace the broken PDF.js worker setup with a bundled local worker
- Update the PDF preview component so `react-pdf` uses a worker bundled by Vite instead of the current CDN `pdf.worker.min.mjs` URL.
- Keep the worker configuration in the same module as the PDF renderer so it is not overwritten by module load order.
- This removes the current runtime failure that is causing every PDF to fall back to “Preview unavailable”.

2. Correct the PDF open flow so “Open in new tab” uses the real file URL
- Adjust the viewer actions so PDFs prefer the original storage/signed URL for new-tab opening instead of the generated `blob:` URL.
- Keep blob-based download support, since that gives reliable downloads even for protected files.
- Preserve current in-app handling for images, video, audio, and text.

3. Tighten file-type handling and viewer fallbacks
- Ensure PDF detection continues to work from either MIME type or `.pdf` extension.
- Keep DOC/DOCX and other Office formats out of iframe/object/embed preview and show the fallback actions instead.
- Standardize the failure message to: “Preview unavailable. Download or open in new tab.” when rendering or fetching fails.

4. Verify the event interception path still routes files into the in-app modal
- Confirm the existing click interception and `openStoredFile` event path continue to send PDFs into the modal viewer.
- Keep the current database/file-card interactions intact while avoiding accidental full-page navigation.

5. Validate the full user flow after the fix
- Confirm a PDF opens inside the modal and renders pages.
- Confirm “Open in new tab” opens the original file in a browser tab instead of a `blob:` URL.
- Confirm download still works.
- Confirm unsupported document types show the clean fallback state.

## Technical details

Files to update:
- `src/components/file-viewer/PdfPreview.tsx`
- `src/components/file-viewer/FileViewerProvider.tsx`
- Possibly `src/lib/file-upload.ts` if any URL normalization is needed during testing

Key implementation details:
- Replace:
  - `pdfjs.GlobalWorkerOptions.workerSrc = https://cdnjs.cloudflare.com/...`
- With a Vite-bundled worker URL pattern such as:
  - `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()`
  - or equivalent asset import supported by the package/version in this repo
- Update `handleOpenNewTab()` so PDFs use `opts.url` first, while downloads can still use the blob URL.
- Keep PDF rendering page-by-page with the existing controls: loading state, zoom, page navigation, download, and open-in-new-tab fallback.