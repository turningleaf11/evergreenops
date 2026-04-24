## Plan

Remove the duplicate close (X) button in the PDF / file viewer modal.

The modal currently shows two X icons in the top-right corner because:
- The shared `DialogContent` component already renders its own built-in close button.
- `FileViewerProvider` adds an additional custom X button in its header row.

### Change

In `src/components/file-viewer/FileViewerProvider.tsx`, remove the custom X button from the header (and its now-unused `X` icon import). The built-in `DialogContent` close button will remain and continue to close the viewer.

### Files

- `src/components/file-viewer/FileViewerProvider.tsx` — drop the extra `<Button><X /></Button>` in the modal header; keep Download and Open in new tab actions; add a small spacer so those actions don't collide with the built-in close button in the corner.