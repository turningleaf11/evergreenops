import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, X, FileText, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getStoragePathFromUrl } from "@/lib/file-upload";
import { toast } from "@/hooks/use-toast";

type OpenOpts = { url: string; fileName?: string; mimeType?: string };

type Ctx = { open: (opts: OpenOpts) => void };
const FileViewerContext = createContext<Ctx | null>(null);

export function useFileViewer() {
  const ctx = useContext(FileViewerContext);
  if (!ctx) throw new Error("useFileViewer must be used inside <FileViewerProvider>");
  return ctx;
}

function inferKind(name: string, mime?: string): "image" | "pdf" | "video" | "audio" | "text" | "other" {
  const m = (mime || "").toLowerCase();
  const n = (name || "").toLowerCase();
  if (m.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp|avif|heic)$/i.test(n)) return "image";
  if (m === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (m.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(n)) return "video";
  if (m.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|aac)$/i.test(n)) return "audio";
  if (m.startsWith("text/") || /\.(txt|md|csv|json|log|yml|yaml)$/i.test(n)) return "text";
  return "other";
}

export function FileViewerProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<OpenOpts | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedMime, setResolvedMime] = useState<string | undefined>(undefined);

  const open = useCallback((o: OpenOpts) => {
    setOpts(o);
    setBlobUrl(null);
    setTextContent(null);
    setError(null);
    setResolvedMime(o.mimeType);
  }, []);

  // Listen for global open-file events + intercept clicks on <a class="file-attachment">.
  useEffect(() => {
    (window as any).__lovableFileViewerMounted = true;
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent<OpenOpts>).detail;
      if (detail?.url) open(detail);
      e.preventDefault?.();
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      const a = (e.target as HTMLElement)?.closest?.("a.file-attachment, a[data-file-attachment]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href === "#") return;
      e.preventDefault();
      e.stopPropagation();
      open({ url: href, fileName: a.getAttribute("data-file-name") || a.textContent?.replace(/^📎\s*/, "") || undefined });
    };
    window.addEventListener("lovable:open-file", onEvent as EventListener);
    document.addEventListener("click", onClick, true);
    return () => {
      (window as any).__lovableFileViewerMounted = false;
      window.removeEventListener("lovable:open-file", onEvent as EventListener);
      document.removeEventListener("click", onClick, true);
    };
  }, [open]);

  const close = useCallback(() => {
    setOpts(null);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }
    setTextContent(null);
    setError(null);
  }, [blobUrl]);

  const fileName = opts?.fileName || (opts?.url ? opts.url.split("/").pop()?.split("?")[0] || "file" : "file");
  const kind = inferKind(fileName, resolvedMime || opts?.mimeType);

  // Load file as a blob (works around CORS/auth and enables real Download)
  useEffect(() => {
    if (!opts) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Prefer Supabase Storage download when the URL is a known storage URL
        const storagePath = getStoragePathFromUrl(opts.url);
        let blob: Blob;
        if (storagePath) {
          const { data, error } = await supabase.storage.from("files").download(storagePath);
          if (error || !data) throw new Error(error?.message || "Download failed");
          blob = data;
        } else {
          const res = await fetch(opts.url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          blob = await res.blob();
        }
        if (cancelled) return;
        setResolvedMime(prev => prev || blob.type || undefined);
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);

        if (inferKind(fileName, blob.type) === "text") {
          const txt = await blob.text();
          if (!cancelled) setTextContent(txt);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Could not load file");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts?.url]);

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleOpenNewTab = () => {
    // Use the blob URL when available so cross-origin / auth issues don't break it
    const target = blobUrl || opts?.url;
    if (!target) return;
    const win = window.open(target, "_blank", "noopener,noreferrer");
    if (!win) {
      // Popup blocked — fall back to programmatic anchor
      const a = document.createElement("a");
      a.href = target;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast({ title: "If nothing opened, allow pop-ups for this site." });
    }
  };

  return (
    <FileViewerContext.Provider value={{ open }}>
      {children}
      <Dialog open={!!opts} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2.5 shrink-0">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="text-sm font-medium truncate flex-1 min-w-0">{fileName}</div>
            <Button size="sm" variant="ghost" onClick={handleDownload} disabled={!blobUrl}>
              <Download className="h-4 w-4 mr-1.5" /> Download
            </Button>
            <Button size="sm" variant="ghost" onClick={handleOpenNewTab} disabled={!blobUrl && !opts?.url}>
              <ExternalLink className="h-4 w-4 mr-1.5" /> Open in new tab
            </Button>
            <Button size="icon" variant="ghost" onClick={close}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 bg-muted/30 overflow-auto">
            {loading && (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading file…
              </div>
            )}

            {!loading && error && (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <div className="text-sm font-medium">Could not load preview</div>
                <p className="text-xs text-muted-foreground max-w-md">{error}</p>
                {opts?.url && (
                  <Button size="sm" variant="outline" onClick={handleOpenNewTab}>
                    <ExternalLink className="h-4 w-4 mr-1.5" /> Try opening in new tab
                  </Button>
                )}
              </div>
            )}

            {!loading && !error && blobUrl && (
              <>
                {kind === "image" && (
                  <div className="h-full flex items-center justify-center p-4">
                    <img src={blobUrl} alt={fileName} className="max-h-full max-w-full object-contain rounded" />
                  </div>
                )}
                {kind === "pdf" && (
                  <iframe src={blobUrl} title={fileName} className="w-full h-full border-0 bg-white" />
                )}
                {kind === "video" && (
                  <div className="h-full flex items-center justify-center p-4">
                    <video src={blobUrl} controls className="max-h-full max-w-full" />
                  </div>
                )}
                {kind === "audio" && (
                  <div className="h-full flex items-center justify-center p-6">
                    <audio src={blobUrl} controls className="w-full max-w-md" />
                  </div>
                )}
                {kind === "text" && (
                  <pre className="p-4 text-xs whitespace-pre-wrap font-mono">{textContent ?? ""}</pre>
                )}
                {kind === "other" && (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
                    <FileText className="h-10 w-10 text-muted-foreground" />
                    <div className="text-sm font-medium">Preview not available</div>
                    <p className="text-xs text-muted-foreground">
                      This file type can't be previewed in-app. Use Download or Open in new tab.
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleDownload}>
                        <Download className="h-4 w-4 mr-1.5" /> Download
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleOpenNewTab}>
                        <ExternalLink className="h-4 w-4 mr-1.5" /> Open in new tab
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </FileViewerContext.Provider>
  );
}
