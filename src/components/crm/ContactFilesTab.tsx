import { useEffect, useState, useCallback } from "react";
import { Upload, FileText, Image as ImageIcon, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uploadFileWithPath, openStoredFile, getStoragePathFromUrl } from "@/lib/file-upload";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ContactFileRow {
  id: string;
  name: string;
  url: string;
  storage_path: string | null;
  size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
}

const isImage = (m: string | null, n: string) =>
  (m && m.startsWith("image/")) || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(n);

const fmtSize = (b: number | null) => {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

export function ContactFilesTab({
  contactId,
  workspaceId,
}: {
  contactId: string;
  workspaceId: string | null;
}) {
  const { user } = useAuth();
  const [files, setFiles] = useState<ContactFileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("crm_activities")
      .select("id, body, subject, occurred_at, metadata")
      .eq("entity_type", "contact")
      .eq("entity_id", contactId)
      .eq("type", "file")
      .order("occurred_at", { ascending: false });
    setFiles(
      ((data || []) as any[]).map((a) => ({
        id: a.id,
        name: a.subject || a.metadata?.name || "file",
        url: a.metadata?.url || "",
        storage_path: a.metadata?.storage_path || null,
        size_bytes: a.metadata?.size_bytes ?? null,
        mime_type: a.metadata?.mime_type ?? null,
        created_at: a.occurred_at,
      })),
    );
    setLoading(false);
  }, [contactId]);

  useEffect(() => { reload(); }, [reload]);

  const handleFiles = async (fileList: FileList | File[]) => {
    if (!user) return;
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const uploaded = await uploadFileWithPath(file);
        if (!uploaded) {
          toast({ title: "Upload failed", description: file.name, variant: "destructive" });
          continue;
        }
        const { error } = await supabase.from("crm_activities").insert({
          workspace_id: workspaceId,
          entity_type: "contact",
          entity_id: contactId,
          type: "file",
          subject: file.name,
          body: "",
          actor_id: user.id,
          metadata: {
            url: uploaded.publicUrl,
            storage_path: uploaded.path,
            size_bytes: file.size,
            mime_type: file.type || null,
            name: file.name,
          },
        });
        if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
      }
      await reload();
    } finally {
      setUploading(false);
    }
  };

  const pickFiles = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = () => input.files && handleFiles(input.files);
    input.click();
  };

  const removeFile = async (f: ContactFileRow) => {
    if (!confirm(`Remove "${f.name}"?`)) return;
    await supabase.from("crm_activities").delete().eq("id", f.id);
    const path = f.storage_path || getStoragePathFromUrl(f.url);
    if (path) await supabase.storage.from("files").remove([path]);
    setFiles((arr) => arr.filter((x) => x.id !== f.id));
  };

  return (
    <div className="space-y-3 max-w-3xl">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-xl border border-dashed p-6 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border/60",
        )}
      >
        <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-2">
          Drop contracts, IDs, proof of funds, or other files here
        </p>
        <Button size="sm" variant="outline" onClick={pickFiles} disabled={uploading}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
          Choose files
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-xs text-muted-foreground py-6">
          <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Loading…
        </div>
      ) : files.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-4">No files attached yet.</p>
      ) : (
        <ul className="divide-y divide-border/40 rounded-xl border border-border/50 overflow-hidden bg-card">
          {files.map((f) => {
            const Icon = isImage(f.mime_type, f.name) ? ImageIcon : FileText;
            return (
              <li key={f.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <button
                  onClick={() => openStoredFile(f.url, { fileName: f.name, mimeType: f.mime_type ?? undefined })}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="text-sm font-medium truncate">{f.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {fmtSize(f.size_bytes)}
                    {f.size_bytes ? " · " : ""}
                    {format(new Date(f.created_at), "MMM d, yyyy")}
                  </div>
                </button>
                <button
                  onClick={() => removeFile(f)}
                  className="text-muted-foreground hover:text-destructive p-1 rounded"
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
