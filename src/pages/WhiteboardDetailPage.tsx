// WhiteboardDetailPage — tldraw canvas. Persists document JSON to Supabase
// with debounced autosave on every change.

import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { Tldraw, type Editor, getSnapshot, loadSnapshot } from "tldraw";
import "tldraw/tldraw.css";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

const sb = supabase as any;

export default function WhiteboardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const [title, setTitle] = useState("Untitled Whiteboard");
  const [loadedDoc, setLoadedDoc] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Cleanup the store listener + pending save when the page unmounts
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // Initial load
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await sb.from("whiteboards").select("title, document").eq("id", id).maybeSingle();
      if (cancelled) return;
      if (data) {
        setTitle(data.title || "Untitled Whiteboard");
        setLoadedDoc(data.document || null);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Persist title
  const saveTitle = async (next: string) => {
    if (!id) return;
    setTitle(next);
    await sb.from("whiteboards").update({ title: next }).eq("id", id);
  };

  // Debounced canvas save
  const scheduleSave = () => {
    if (!editorRef.current || !id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      try {
        if (!editorRef.current) return;
        const snapshot = getSnapshot(editorRef.current.store);
        await sb.from("whiteboards").update({ document: snapshot }).eq("id", id);
      } catch (e: any) {
        toast.error("Save failed: " + e.message);
      } finally {
        setSaving(false);
      }
    }, 800);
  };

  const handleMount = (editor: Editor) => {
    editorRef.current = editor;

    // Theme sync — defensive (editor.user can be undefined in odd states)
    try {
      editor.user?.updateUserPreferences?.({ colorScheme: resolvedTheme === "dark" ? "dark" : "light" });
    } catch (e) { console.warn("Theme sync failed:", e); }

    // Restore canvas state — only if we have a non-empty document snapshot
    if (loadedDoc && typeof loadedDoc === "object" && Object.keys(loadedDoc).length > 0) {
      try { loadSnapshot(editor.store, loadedDoc); }
      catch (e) { console.warn("Could not load whiteboard snapshot:", e); }
    }

    // Wire autosave — store the unsubscribe handle so we can clean up on unmount
    try {
      const unsubscribe = editor.store.listen(() => scheduleSave(), { source: "user", scope: "document" });
      cleanupRef.current = unsubscribe;
    } catch (e) { console.warn("Listener wire failed:", e); }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 shrink-0 bg-card/40">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={() => navigate("/whiteboards")}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All
          </button>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={(e) => saveTitle(e.target.value)}
            className="text-sm font-semibold bg-transparent outline-none flex-1 min-w-0"
          />
        </div>
        <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 shrink-0">
          {saving ? (<><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>) : "Saved"}
        </span>
      </div>

      {/* Canvas — tldraw requires a positioned ancestor with defined size.
         We use a relative wrapper and tell Tldraw to absolutely fill it. */}
      <div className="flex-1 min-h-0 relative">
        {loading ? (
          <div className="flex items-center justify-center h-full gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="absolute inset-0">
            <Tldraw
              key={`${id}-${resolvedTheme}`}
              onMount={handleMount}
              inferDarkMode={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
