import { useState, useCallback, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, FileText, Download, ExternalLink } from "lucide-react";
// Bundle the pdf.js worker locally via Vite so it isn't blocked by ad/tracker
// blockers (e.g. Edge / uBlock blocking cdnjs requests). Must be configured in
// the same module that uses react-pdf to avoid being overwritten by module
// load order.
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfPreviewProps {
  fileUrl: string;
  fileName: string;
  onDownload: () => void;
  onOpenNewTab: () => void;
}

export default function PdfPreview({ fileUrl, fileName, onDownload, onOpenNewTab }: PdfPreviewProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.1);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Memoize file source so react-pdf doesn't reload on every render.
  const file = useMemo(() => ({ url: fileUrl }), [fileUrl]);

  const onLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setPageNumber(1);
    setLoadError(null);
  }, []);

  const onLoadError = useCallback((err: Error) => {
    console.error("PDF load error", err);
    setLoadError(err?.message || "Failed to load PDF");
  }, []);

  if (loadError) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
        <FileText className="h-10 w-10 text-muted-foreground" />
        <div className="text-sm font-medium">Preview unavailable</div>
        <p className="text-xs text-muted-foreground max-w-md">Download or open in new tab.</p>
        <div className="flex gap-2">
          <Button size="sm" onClick={onOpenNewTab}>
            <ExternalLink className="h-4 w-4 mr-1.5" /> Open in new tab
          </Button>
          <Button size="sm" variant="outline" onClick={onDownload}>
            <Download className="h-4 w-4 mr-1.5" /> Download
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-center gap-2 border-b border-border/40 px-3 py-1.5 bg-background/60 backdrop-blur-sm shrink-0">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => setPageNumber(p => Math.max(1, p - 1))}
          disabled={pageNumber <= 1}
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums min-w-[70px] text-center">
          {numPages ? `${pageNumber} / ${numPages}` : "—"}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => setPageNumber(p => Math.min(numPages || p, p + 1))}
          disabled={!numPages || pageNumber >= numPages}
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => setScale(s => Math.max(0.5, +(s - 0.15).toFixed(2)))}
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums w-10 text-center">
          {Math.round(scale * 100)}%
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => setScale(s => Math.min(3, +(s + 0.15).toFixed(2)))}
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      {/* Document */}
      <div className="flex-1 min-h-0 overflow-auto bg-muted/40">
        <div className="flex flex-col items-center py-4 gap-3">
          <Document
            file={file}
            onLoadSuccess={onLoadSuccess}
            onLoadError={onLoadError}
            loading={
              <div className="flex items-center text-muted-foreground py-10">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading PDF…
              </div>
            }
            error={null}
          >
            {numPages > 0 && (
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderAnnotationLayer
                renderTextLayer
                className="shadow-md rounded-sm overflow-hidden bg-white"
              />
            )}
          </Document>
        </div>
      </div>
    </div>
  );
}
