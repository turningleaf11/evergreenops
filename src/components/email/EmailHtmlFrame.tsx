import { useMemo, useRef, useState } from "react";

/**
 * Renders an email's HTML in a sandboxed iframe so it looks like it does in
 * Gmail — the message's own CSS is preserved but fully isolated from the app
 * (no style leaks, no hidden preheader/table content bleeding onto the page).
 * Scripts are blocked; links open in a new tab. The frame auto-sizes to its
 * content height.
 *
 * Used by the inbox thread view and the CRM activity timeline (synced emails).
 */
export function EmailHtmlFrame({ html, minHeight = 40 }: { html: string; minHeight?: number }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(minHeight);

  const srcDoc = useMemo(() => {
    const dark = document.documentElement.classList.contains("dark");
    return `<!doctype html><html><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <base target="_blank">
      <style>
        html,body{margin:0;padding:0;}
        body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
          font-size:14px;line-height:1.5;color:${dark ? "#e5e7eb" : "#1f2937"};
          background:transparent;word-break:break-word;overflow-wrap:anywhere;padding:2px;}
        img{max-width:100%;height:auto;}
        a{color:${dark ? "#93c5fd" : "#2563eb"};}
        table{max-width:100%;}
      </style></head><body>${sanitizeEmailHtml(html)}</body></html>`;
  }, [html]);

  const resize = () => {
    const doc = frameRef.current?.contentDocument;
    if (doc?.body) setHeight(Math.max(minHeight, doc.body.scrollHeight + 8));
  };

  return (
    <iframe
      ref={frameRef}
      title="Email message"
      srcDoc={srcDoc}
      // allow-same-origin lets us measure content height; without allow-scripts
      // the email's own JS still cannot run. allow-popups keeps links clickable.
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      onLoad={resize}
      className="w-full border-0 bg-transparent"
      style={{ height }}
    />
  );
}

/**
 * Strip anything that could execute or break out of the frame. The email's own
 * <style> can stay — it's isolated inside the sandboxed iframe.
 */
export function sanitizeEmailHtml(html: string): string {
  let out = html
    .replace(/<link[^>]*>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<base[^>]*>/gi, "");

  // Force every <a> to open in a new tab with safe rel. Gmail HTML often omits
  // target=_blank, so a Drive/tracking link tries to navigate our SPA.
  out = out.replace(/<a\b([^>]*)>/gi, (_m, attrs: string) => {
    let a = attrs;
    a = a.replace(/\s(target|rel)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    return `<a${a} target="_blank" rel="noopener noreferrer nofollow">`;
  });

  return out;
}

export default EmailHtmlFrame;
