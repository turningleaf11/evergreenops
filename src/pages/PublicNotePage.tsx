import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Loader2 } from "lucide-react";
import "@/components/RichTextEditor.css";

interface PublicNote {
  id: string;
  title: string;
  content: string;
  updated_at: string;
}

export default function PublicNotePage() {
  const { token } = useParams<{ token: string }>();
  const [note, setNote] = useState<PublicNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("id, title, content, updated_at")
        .eq("share_token", token)
        .eq("is_public", true)
        .maybeSingle();
      if (error || !data) {
        setError("This note isn't available.");
      } else {
        setNote(data as PublicNote);
        document.title = `${data.title} · Shared note`;
      }
      setLoading(false);
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-sm">
          <div className="h-12 w-12 rounded-xl bg-muted mx-auto flex items-center justify-center mb-3">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <h1 className="text-lg font-semibold">Note unavailable</h1>
          <p className="text-sm text-muted-foreground mt-1">{error || "This shared link is invalid or has been disabled."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 lg:px-16 py-12">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Shared note</div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">{note.title}</h1>
        <div className="text-xs text-muted-foreground mb-8">
          Last updated {new Date(note.updated_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
        </div>
        <div className="rich-editor">
          <div
            className="tiptap prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: note.content || "<p class='text-muted-foreground'>This note is empty.</p>" }}
          />
        </div>
        <div className="mt-16 pt-6 border-t border-border/50 text-center">
          <a href="/" className="text-xs text-muted-foreground hover:text-foreground">Powered by your workspace</a>
        </div>
      </div>
    </div>
  );
}
